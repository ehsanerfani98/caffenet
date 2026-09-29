import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { AuditService } from '../audit/audit.service';
import { RequestStatusMachine } from './request-status-machine';
import {
  AuditAction,
  DOMAIN_EVENTS,
  REQUEST_ADMIN_ONLY_STATUSES,
  RequestStatus,
} from '@caffenet/shared';
import { UpdateRequestStatusDto } from './dto/request.dto';

/**
 * Request workflow service — status transitions (Phase 4.2).
 *
 * Guarantees:
 *  - Transitions are validated against the state machine INSIDE the transaction
 *    (re-reads the row with SELECT FOR UPDATE semantics via Serializable tx)
 *  - Every transition writes a RequestStatusHistory row atomically (4.2.4)
 *  - Persian notes supported per transition (4.2.5)
 *  - Emits 'request.status_changed' (internal bus) + Pusher RequestStatusChanged
 *    on the request channel AND user channels for customer/operator (4.2.7)
 */
@Injectable()
export class RequestWorkflowService {
  private readonly logger = new Logger(RequestWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Operator/admin endpoint: change request status.
   * 'paid' is financial — admin-only here (payment gateway automates it in Phase 6).
   */
  async changeStatus(
    requestId: string,
    dto: UpdateRequestStatusDto,
    actorId: string,
    roles: string[],
  ) {
    const isAdmin = roles.includes('admin');
    if (!isAdmin && (REQUEST_ADMIN_ONLY_STATUSES as readonly string[]).includes(dto.status)) {
      throw new ForbiddenException(
        `تغییر وضعیت به «${RequestStatusMachine.faLabel(dto.status)}» فقط توسط ادمین مجاز است`,
      );
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        // Lock the row to serialize concurrent transitions
        const rows = await tx.$queryRaw<
          Array<{
            id: bigint;
            status: string;
            tracking_code: string;
            customer_id: bigint;
            assigned_operator_id: bigint | null;
          }>
        >(
          Prisma.sql`SELECT id, status, tracking_code, customer_id, assigned_operator_id FROM requests WHERE id = ${BigInt(requestId)} FOR UPDATE`,
        );
        const locked = rows[0];
        if (!locked) throw new NotFoundException('درخواست یافت نشد');

        // State machine enforcement (4.2.6)
        RequestStatusMachine.enforce(locked.status, dto.status);

        // Side effects on the request row
        const now = new Date();
        const data: Record<string, unknown> = { status: dto.status };
        if (dto.status === RequestStatus.PAID) data.paymentStatus = 'paid';
        if (dto.status === RequestStatus.COMPLETED) data.completedAt = now;
        if (dto.status === RequestStatus.REJECTED) data.completedAt = null;

        await tx.request.update({ where: { id: locked.id }, data });

        // Auto-record history (4.2.4) with optional note (4.2.5)
        const history = await tx.requestStatusHistory.create({
          data: {
            requestId: locked.id,
            previousStatus: locked.status,
            newStatus: dto.status,
            userId: BigInt(actorId),
            note: dto.note,
          },
        });
        return {
          id: locked.id,
          trackingCode: locked.tracking_code,
          customerId: locked.customer_id,
          assignedOperatorId: locked.assigned_operator_id,
          previousStatus: locked.status,
          newStatus: dto.status,
          historyId: history.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      `Request ${result.trackingCode} status: ${result.previousStatus} → ${result.newStatus} (by ${actorId})`,
    );

    // Post-commit events (4.2.7) — internal bus + Pusher
    const payload = {
      requestId: result.id.toString(),
      trackingCode: result.trackingCode,
      previousStatus: result.previousStatus,
      status: result.newStatus,
      statusFa: RequestStatusMachine.faLabel(result.newStatus),
      note: dto.note ?? null,
      changedBy: actorId,
      at: new Date().toISOString(),
    };
    await this.events.emit(DOMAIN_EVENTS.REQUEST_STATUS_CHANGED, payload);
    await this.realtime.notifyRequestStatusChanged(result.id.toString(), payload);
    await this.realtime.notifyUser(result.customerId.toString(), 'RequestStatusChanged', payload);
    if (result.assignedOperatorId) {
      await this.realtime.notifyUser(
        result.assignedOperatorId.toString(),
        'RequestStatusChanged',
        payload,
      );
    }

    await this.audit.log({
      userId: actorId,
      action: AuditAction.STATUS_CHANGE,
      entity: 'request',
      entityId: result.trackingCode,
      oldData: { status: result.previousStatus },
      newData: { status: result.newStatus, note: dto.note },
    });

    return {
      requestId: result.id.toString(),
      trackingCode: result.trackingCode,
      previousStatus: result.previousStatus,
      status: result.newStatus,
      statusFa: RequestStatusMachine.faLabel(result.newStatus),
      note: dto.note ?? null,
    };
  }

  /** Allowed next statuses for a request — used by UIs and docs. */
  async allowedTransitions(requestId: string) {
    const request = await this.prisma.request.findUnique({
      where: { id: BigInt(requestId) },
      select: { id: true, status: true },
    });
    if (!request) throw new NotFoundException('درخواست یافت نشد');
    return {
      requestId: request.id.toString(),
      status: request.status,
      allowed: RequestStatusMachine.nextStatuses(request.status),
    };
  }
}
