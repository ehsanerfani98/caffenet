import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RequestStatusMachine } from './request-status-machine';
import { ActorInfo } from './requests.service';
import {
  RequestAssignmentDto,
  RequestStatusHistoryDto,
  RequestTimelineEntryDto,
} from '@caffenet/shared';

/**
 * Request history & timeline (Phase 4.4).
 *
 *  - 4.4.1 history: raw status-change log (audit-grade, oldest → newest)
 *  - 4.4.2 timeline: UI-friendly merged stream of milestones
 *    (created / status changes / assignments / attachments), newest → oldest
 *
 * Authorization mirrors request detail: owner customer, assigned operator, admin.
 */
@Injectable()
export class RequestHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Raw status history (4.4.1). */
  async getHistory(
    requestId: string,
    actor: ActorInfo,
  ): Promise<{ items: RequestStatusHistoryDto[] }> {
    const request = await this.prisma.request.findUnique({
      where: { id: BigInt(requestId) },
      select: { id: true, customerId: true, assignedOperatorId: true },
    });
    if (!request) throw new NotFoundException('درخواست یافت نشد');
    this.assertCanView(request.customerId, request.assignedOperatorId, actor);

    const rows = await this.prisma.requestStatusHistory.findMany({
      where: { requestId: request.id },
      orderBy: { createdAt: 'asc' },
      include: { request: false },
    });

    // Resolve actor names in one query
    const userIds = [...new Set(rows.map((r) => r.userId.toString()))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds.map((u) => BigInt(u)) } },
      select: { id: true, fullName: true, phone: true },
    });
    const nameMap = new Map(users.map((u) => [u.id.toString(), u.fullName ?? u.phone]));

    return {
      items: rows.map((h) => ({
        id: h.id.toString(),
        requestId: h.requestId.toString(),
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        userId: h.userId.toString(),
        userName: nameMap.get(h.userId.toString()) ?? null,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }

  /** UI-friendly merged timeline (4.4.2) — newest first. */
  async getTimeline(
    requestId: string,
    actor: ActorInfo,
  ): Promise<{ items: RequestTimelineEntryDto[] }> {
    const request = await this.prisma.request.findUnique({
      where: { id: BigInt(requestId) },
      include: {
        statusHistories: { orderBy: { createdAt: 'asc' } },
        assignments: { orderBy: { createdAt: 'asc' }, include: { request: false } },
        attachments: { orderBy: { createdAt: 'asc' }, include: { file: true } },
        service: { select: { name: true } },
      },
    });
    if (!request) throw new NotFoundException('درخواست یافت نشد');
    this.assertCanView(request.customerId, request.assignedOperatorId, actor);

    const entries: RequestTimelineEntryDto[] = [];

    // Birth of the request
    entries.push({
      at: request.createdAt.toISOString(),
      type: 'created',
      title: 'درخواست ثبت شد',
      description: `خدمت: ${request.service?.name ?? '—'} · کد رهگیری: ${request.trackingCode}`,
      actorId: request.customerId.toString(),
      meta: { status: 'pending' },
    });

    // Status changes (skip the synthetic "attachment" entries where prev === new)
    for (const h of request.statusHistories) {
      const isPureNote = h.previousStatus === h.newStatus;
      if (isPureNote) {
        entries.push({
          at: h.createdAt.toISOString(),
          type: 'note',
          title: h.note ?? 'یادداشت',
          actorId: h.userId.toString(),
          meta: { historyId: h.id.toString() },
        });
        continue;
      }
      const terminalType =
        h.newStatus === 'completed'
          ? 'completed'
          : h.newStatus === 'cancelled'
            ? 'cancelled'
            : 'status_changed';
      entries.push({
        at: h.createdAt.toISOString(),
        type: terminalType,
        title:
          h.previousStatus === null
            ? 'درخواست ثبت شد'
            : `تغییر وضعیت: ${RequestStatusMachine.faLabel(h.previousStatus)} ← ${RequestStatusMachine.faLabel(h.newStatus)}`,
        description: h.note,
        actorId: h.userId.toString(),
        meta: { previousStatus: h.previousStatus, status: h.newStatus },
      });
    }

    // Assignments
    for (const a of request.assignments) {
      entries.push({
        at: (a.unassignedAt ?? a.createdAt).toISOString(),
        type: a.active ? 'assigned' : 'unassigned',
        title: a.active
          ? `تخصیص به اپراتور #${a.operatorId}`
          : `رفع تخصیص اپراتور #${a.operatorId}`,
        description: a.note,
        actorId: a.assignedBy.toString(),
        meta: {
          assignmentId: a.id.toString(),
          operatorId: a.operatorId.toString(),
          active: a.active,
        },
      });
    }

    // Attachments
    for (const at of request.attachments) {
      entries.push({
        at: at.createdAt.toISOString(),
        type: 'attachment_added',
        title: `پیوست فایل: ${at.file?.originalName ?? '#' + at.fileId}`,
        actorId: at.uploadedBy.toString(),
        meta: { attachmentId: at.id.toString(), fileId: at.fileId.toString() },
      });
    }

    // Customer/operator/admin display names
    const userIds = [
      ...new Set(
        entries
          .map((e) => e.actorId)
          .filter((v): v is string => typeof v === 'string' && v.length > 0),
      ),
    ];
    let nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds.map((u) => BigInt(u)) } },
        select: { id: true, fullName: true, phone: true },
      });
      nameMap = new Map(users.map((u) => [u.id.toString(), u.fullName ?? u.phone]));
    }
    for (const e of entries) {
      if (e.actorId) e.actorName = nameMap.get(e.actorId) ?? null;
    }

    // Sort newest → oldest (stable enough for UI)
    entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return { items: entries };
  }

  /** Assignment history for a request (operator rotation audit). */
  async getAssignments(
    requestId: string,
    actor: ActorInfo,
  ): Promise<{ items: RequestAssignmentDto[] }> {
    const request = await this.prisma.request.findUnique({
      where: { id: BigInt(requestId) },
      select: { id: true, customerId: true, assignedOperatorId: true },
    });
    if (!request) throw new NotFoundException('درخواست یافت نشد');
    this.assertCanView(request.customerId, request.assignedOperatorId, actor);

    const rows = await this.prisma.requestAssignment.findMany({
      where: { requestId: request.id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: rows.map((a) => ({
        id: a.id.toString(),
        requestId: a.requestId.toString(),
        operatorId: a.operatorId.toString(),
        assignedBy: a.assignedBy.toString(),
        active: a.active,
        note: a.note,
        createdAt: a.createdAt.toISOString(),
        unassignedAt: a.unassignedAt ? a.unassignedAt.toISOString() : null,
      })),
    };
  }

  private assertCanView(
    customerId: bigint,
    assignedOperatorId: bigint | null,
    actor: ActorInfo,
  ): void {
    if (actor.roles.includes('admin')) return;
    if (customerId.toString() === actor.id) return;
    if (actor.roles.includes('operator') && assignedOperatorId?.toString() === actor.id) return;
    throw new ForbiddenException('شما به این درخواست دسترسی ندارید');
  }
}
