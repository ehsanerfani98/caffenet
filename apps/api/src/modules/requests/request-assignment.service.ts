import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { AuditService } from '../audit/audit.service';
import { RequestStatusMachine } from './request-status-machine';
import { AuditAction, DOMAIN_EVENTS } from '@caffenet/shared';
import { AssignRequestDto } from './dto/request.dto';

export interface AssignmentResult {
  requestId: string;
  operatorId: string;
  operatorName?: string;
  assignmentId?: string;
  active?: boolean;
  note?: string | null;
  createdAt?: Date;
  strategy?: string;
}

/**
 * Request assignment service (Phase 4.3).
 *
 *  - 4.3.1 operator self-assign (or admin assigns anyone via operator route)
 *  - 4.3.2 admin force-assign
 *  - 4.3.3 unassign + reassign (previous active assignment is closed, history kept)
 *  - 4.3.4 RequestAssigned event (internal bus + Pusher)
 *  - 4.3.5 auto-assign strategies: round_robin | least_load (configurable)
 */
@Injectable()
export class RequestAssignmentService {
  private readonly logger = new Logger(RequestAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Phase 8.2.2 — "Take next from queue": pick the oldest unassigned request
   * (pending first, then reviewing) and self-assign it to the operator.
   * Throws NotFoundException when the queue is empty.
   */
  async takeNextForOperator(
    operatorId: string,
    ctx?: { ip?: string; userAgent?: string },
  ): Promise<AssignmentResult & { trackingCode: string; serviceName: string }> {
    const candidate =
      (await this.prisma.request.findFirst({
        where: { assignedOperatorId: null, status: 'pending' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })) ??
      (await this.prisma.request.findFirst({
        where: { assignedOperatorId: null, status: 'reviewing' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      }));

    if (!candidate) {
      throw new NotFoundException('درخواستی در صف موجود نیست');
    }

    const result = await this.assign(
      candidate.id.toString(),
      { note: 'برداشتن از صف (تکمیل خودکار داشبورد)' },
      operatorId,
      ['operator'],
    );

    const request = await this.prisma.request.findUnique({
      where: { id: candidate.id },
      select: { trackingCode: true, service: { select: { name: true } } },
    });

    this.audit.log({
      userId: operatorId,
      action: AuditAction.ASSIGN,
      entity: 'request',
      entityId: result.requestId,
      newData: { takeNext: true, operatorId },
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

    return {
      ...result,
      trackingCode: request?.trackingCode ?? '',
      serviceName: request?.service.name ?? '',
    };
  }

  /**
   * Assign an operator to a request.
   *  - operator WITHOUT operatorId → self-assign
   *  - operator WITH operatorId≠self → forbidden (use admin route)
   *  - admin → may assign anyone; operatorId omitted + strategy → auto-assign
   */
  async assign(
    requestId: string,
    dto: AssignRequestDto,
    actorId: string,
    roles: string[],
  ): Promise<AssignmentResult> {
    const isAdmin = roles.includes('admin');
    const isOperator = roles.includes('operator');
    if (!isAdmin && !isOperator) {
      throw new ForbiddenException('فقط اپراتور یا ادمین می‌تواند درخواست را تخصیص دهد');
    }

    // Resolve target operator
    let operatorId: bigint | null = null;
    if (dto.operatorId) {
      if (!isAdmin && dto.operatorId.toString() !== actorId) {
        throw new ForbiddenException('اپراتور فقط می‌تواند درخواست را به خودش تخصیص دهد');
      }
      operatorId = BigInt(dto.operatorId);
    } else if (isAdmin && (dto.strategy || dto.strategy === undefined)) {
      // Admin without target → auto-assign (or explicit strategy)
      return this.autoAssign(requestId, dto.strategy ?? 'round_robin', actorId, dto.note);
    } else if (isOperator) {
      operatorId = BigInt(actorId); // self-assign
    }
    if (!operatorId) throw new BadRequestException('اپراتور مقصد مشخص نشده است');

    const operator = await this.prisma.user.findFirst({
      where: { id: operatorId, status: 'active' },
      include: { roles: { include: { role: true } } },
    });
    if (!operator) throw new NotFoundException('اپراتور یافت نشد یا غیرفعال است');
    const hasOperatorRole = operator.roles.some(
      (r) => r.role.name === 'operator' || r.role.name === 'admin',
    );
    if (!hasOperatorRole) throw new ConflictException('کاربر انتخاب‌شده نقش اپراتور ندارد');

    const assignment = await this.prisma.$transaction(
      async (tx) => {
        const request = await tx.request.findUnique({ where: { id: BigInt(requestId) } });
        if (!request) throw new NotFoundException('درخواست یافت نشد');
        if (request.assignedOperatorId === operatorId) {
          throw new ConflictException('این درخواست هم‌اکنون به همین اپراتور تخصیص دارد');
        }
        if (['cancelled', 'rejected'].includes(request.status)) {
          throw new ConflictException(
            `به درخواست در وضعیت «${RequestStatusMachine.faLabel(request.status)}» نمی‌توان اپراتور تخصیص داد`,
          );
        }

        // Close previous active assignment (4.3.3 — history preserved)
        await tx.requestAssignment.updateMany({
          where: { requestId: request.id, active: true },
          data: { active: false, unassignedAt: new Date() },
        });

        // If request had a different operator and status is pending → move to reviewing
        const previousStatus = request.status;
        let newStatus = request.status;
        if (previousStatus === 'pending') {
          newStatus = 'reviewing';
        }

        const [updated, created] = await Promise.all([
          tx.request.update({
            where: { id: request.id },
            data: { assignedOperatorId: operatorId!, status: newStatus },
          }),
          tx.requestAssignment.create({
            data: {
              requestId: request.id,
              operatorId: operatorId!,
              assignedBy: BigInt(actorId),
              active: true,
              note: dto.note,
            },
          }),
        ]);

        // Status history when assignment moved pending → reviewing
        if (newStatus !== previousStatus) {
          await tx.requestStatusHistory.create({
            data: {
              requestId: request.id,
              previousStatus,
              newStatus,
              userId: BigInt(actorId),
              note: `تخصیص به اپراتور #${operatorId}`,
            },
          });
        }
        void updated;
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // 4.3.4 events
    const payload = {
      requestId: assignment.requestId.toString(),
      assignmentId: assignment.id.toString(),
      operatorId: operatorId.toString(),
      operatorName: operator.fullName ?? operator.phone,
      assignedBy: actorId,
      note: dto.note ?? null,
      at: assignment.createdAt,
    };
    await this.events.emit(DOMAIN_EVENTS.REQUEST_ASSIGNED, payload);
    await this.realtime
      .notifyRequestStatusChanged(assignment.requestId.toString(), {
        event: 'RequestAssigned',
        ...payload,
      })
      .catch(() => undefined);
    await this.realtime.notifyUser(operatorId.toString(), 'RequestAssigned', payload);

    await this.audit.log({
      userId: actorId,
      action: AuditAction.ASSIGN,
      entity: 'request',
      entityId: requestId,
      newData: { operatorId: operatorId.toString() },
    });

    this.logger.log(`Request #${requestId} assigned to operator ${operatorId} by ${actorId}`);
    return {
      requestId,
      operatorId: operatorId.toString(),
      operatorName: operator.fullName ?? operator.phone,
      assignmentId: assignment.id.toString(),
      active: true,
      note: dto.note ?? null,
      createdAt: assignment.createdAt,
    };
  }

  /** Admin force-assign (4.3.2) — delegates to assign(). */
  async forceAssign(requestId: string, dto: AssignRequestDto, actorId: string) {
    if (!dto.operatorId) {
      return this.autoAssign(requestId, dto.strategy ?? 'round_robin', actorId, dto.note);
    }
    return this.assign(requestId, { ...dto, operatorId: dto.operatorId }, actorId, ['admin']);
  }

  /** Unassign the current operator (4.3.3). */
  async unassign(requestId: string, note: string | undefined, actorId: string) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const request = await tx.request.findUnique({ where: { id: BigInt(requestId) } });
        if (!request) throw new NotFoundException('درخواست یافت نشد');
        if (!request.assignedOperatorId) {
          throw new ConflictException('این درخواست اپراتوری ندارد');
        }

        await tx.requestAssignment.updateMany({
          where: { requestId: request.id, active: true },
          data: { active: false, unassignedAt: new Date() },
        });
        const updated = await tx.request.update({
          where: { id: request.id },
          data: { assignedOperatorId: null },
        });

        await tx.requestStatusHistory.create({
          data: {
            requestId: request.id,
            previousStatus: updated.status,
            newStatus: updated.status,
            userId: BigInt(actorId),
            note: note ?? 'رفع تخصیص اپراتور',
          },
        });
        return { previousOperatorId: request.assignedOperatorId, status: updated.status };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.events.emit('request.unassigned', {
      requestId,
      previousOperatorId: result.previousOperatorId.toString(),
      by: actorId,
    });
    await this.realtime
      .notifyUser(result.previousOperatorId.toString(), 'RequestUnassigned', { requestId })
      .catch(() => undefined);

    this.logger.log(`Request #${requestId} unassigned by ${actorId}`);
    return { requestId, assignedOperatorId: null, message: 'تخصیص اپراتور برداشته شد' };
  }

  /**
   * Auto-assign (4.3.5).
   *  - round_robin: operator with oldest last-assignment among active operators
   *  - least_load: operator with fewest active requests
   */
  async autoAssign(
    requestId: string,
    strategy: 'round_robin' | 'least_load',
    actorId: string,
    note?: string,
  ): Promise<AssignmentResult> {
    const operators = await this.getActiveOperators();
    if (operators.length === 0) {
      throw new ConflictException('هیچ اپراتور فعالی برای تخصیص وجود ندارد');
    }

    let chosen = operators[0]!;
    if (strategy === 'least_load') {
      const loads = await this.prisma.request.groupBy({
        by: ['assignedOperatorId'],
        where: {
          assignedOperatorId: { in: operators.map((o) => o.id) },
          status: {
            in: ['reviewing', 'waiting_for_customer', 'in_progress', 'waiting_for_payment'],
          },
        },
        _count: { assignedOperatorId: true },
      });
      const loadMap = new Map(
        loads.map((l) => [l.assignedOperatorId?.toString(), l._count.assignedOperatorId]),
      );
      chosen = operators.reduce((best, o) => {
        const loadO = loadMap.get(o.id.toString()) ?? 0;
        const loadB = loadMap.get(best.id.toString()) ?? 0;
        return loadO < loadB ? o : best;
      }, operators[0]!);
    } else {
      // round_robin — operator with oldest most-recent assignment gets the next one
      const lastAssignments = await this.prisma.requestAssignment.groupBy({
        by: ['operatorId'],
        where: { operatorId: { in: operators.map((o) => o.id) } },
        _max: { createdAt: true },
      });
      const lastMap = new Map(
        lastAssignments.map((a) => [a.operatorId.toString(), a._max.createdAt?.getTime() ?? 0]),
      );
      chosen = operators.reduce((best, o) => {
        const tO = lastMap.get(o.id.toString()) ?? 0;
        const tB = lastMap.get(best.id.toString()) ?? 0;
        return tO < tB ? o : best;
      }, operators[0]!);
    }

    this.logger.log(`Auto-assign (${strategy}): request #${requestId} → operator #${chosen.id}`);
    return this.assign(
      requestId,
      { operatorId: Number(chosen.id), note: note ?? `تخصیص خودکار (${strategy})` },
      actorId,
      ['admin'],
    );
  }

  private async getActiveOperators(): Promise<Array<{ id: bigint }>> {
    const rows = await this.prisma.user.findMany({
      where: {
        status: 'active',
        roles: { some: { role: { name: 'operator' } } },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return rows;
  }
}
