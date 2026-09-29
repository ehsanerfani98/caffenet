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
import { toMajor, toMinor } from '../../common/utils/money';
import {
  AuditAction,
  COST_CHANGE_TYPES,
  DOMAIN_EVENTS,
  DiscountType,
  RequestStatus,
} from '@caffenet/shared';

import { UpdateRequestCostsDto } from './dto/costs.dto';

type Tx = Prisma.TransactionClient;

interface CostHistoryRow {
  requestCostId: number;
  changeType: string;
  previousAmount: bigint;
  newAmount: bigint;
  userId: bigint;
  reason?: string;
}

export interface CostActor {
  id: string;
  roles: string[];
}

/**
 * RequestCosts service — pricing snapshot + cost management (Phase 5.1 / 5.2).
 *
 * Guarantees:
 *  - Money is ALWAYS BigInt minor units (Rial) in the DB; DTOs use Toman.
 *  - FinalTotal = Labor + Material + Additional − Discount (5.2.3) computed
 *    SERVER-SIDE with integer math only (5.1.4); negative totals rejected (5.2.4).
 *  - EVERY component mutation writes RequestCostHistory rows (5.2.5) in the
 *    SAME transaction as the update.
 *  - Updates run inside a Serializable transaction with SELECT … FOR UPDATE
 *    row locks on BOTH the request and its cost row.
 *  - Emits `request.price_changed` (internal bus) + Pusher RequestPriceChanged
 *    on the request channel and user channels (5.2.6).
 *  - Discount component is owned by DiscountsService — this service only
 *    recomputes totals from the stored discountAmount.
 */
@Injectable()
export class RequestCostsService {
  private readonly logger = new Logger(RequestCostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
  ) {}

  // ==================== READ (with authorization) ====================

  /** Price breakdown for one request — customer(owner) / assigned operator / admin. */
  async getCosts(requestId: string, actor: CostActor) {
    const cost = await this.prisma.requestCost.findUnique({
      where: { requestId: this.toId(requestId) },
      include: {
        request: {
          select: { id: true, customerId: true, assignedOperatorId: true, trackingCode: true },
        },
      },
    });
    if (!cost) throw new NotFoundException('اطلاعات قیمت برای این درخواست یافت نشد');
    this.assertCanView(cost.request, actor);
    return this.serializeCost(cost);
  }

  /** Full cost mutation audit trail — same authorization as getCosts. */
  async getCostHistory(requestId: string, actor: CostActor) {
    const cost = await this.prisma.requestCost.findUnique({
      where: { requestId: this.toId(requestId) },
      include: {
        request: {
          select: { id: true, customerId: true, assignedOperatorId: true, trackingCode: true },
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 200,
          include: { requestCost: { select: { requestId: true } } },
        },
      },
    });
    if (!cost) throw new NotFoundException('اطلاعات قیمت برای این درخواست یافت نشد');
    this.assertCanView(cost.request, actor);
    // requestCostId is per-request; requestId is constant — resolve once
    const rid = cost.requestId.toString();
    return {
      requestId: rid,
      trackingCode: cost.request.trackingCode,
      entries: cost.history.map((h) => ({
        id: h.id.toString(),
        requestCostId: h.requestCostId.toString(),
        requestId: rid,
        changeType: h.changeType,
        previousAmount: toMajor(Number(h.previousAmount)),
        newAmount: toMajor(Number(h.newAmount)),
        userId: h.userId.toString(),
        reason: h.reason ?? null,
        createdAt: h.createdAt,
      })),
    };
  }

  // ==================== UPDATE (5.2.1 – 5.2.6) ====================

  /**
   * Operator/admin: set material + additional costs on a request.
   *  - Serializable tx + FOR UPDATE locks (request row AND cost row)
   *  - Recomputes final total server-side (5.2.3), rejects negatives (5.2.4)
   *  - Writes one history row per changed component (5.2.5)
   *  - Emits request.price_changed + Pusher RequestPriceChanged (5.2.6)
   */
  async updateCosts(requestId: string, dto: UpdateRequestCostsDto, actor: CostActor) {
    const rid = this.toId(requestId);
    const isAdmin = actor.roles.includes('admin');
    const isOperator = actor.roles.includes('operator');
    if (!isAdmin && !isOperator) {
      throw new ForbiddenException('فقط اپراتور یا ادمین مجاز به تغییر هزینه است');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        // Lock the request row first (status checks + authorization source)
        const locked = await tx.$queryRaw<
          Array<{
            id: bigint;
            tracking_code: string;
            status: string;
            customer_id: bigint;
            assigned_operator_id: bigint | null;
            final_total: bigint;
          }>
        >(
          Prisma.sql`SELECT id, tracking_code, status, customer_id, assigned_operator_id, final_total FROM requests WHERE id = ${rid} FOR UPDATE`,
        );
        const request = locked[0];
        if (!request) throw new NotFoundException('درخواست یافت نشد');

        // Authorization: admin → any; operator → must be assigned
        if (!isAdmin && request.assigned_operator_id?.toString() !== actor.id) {
          throw new ForbiddenException('این درخواست به شما تخصیص نیافته است');
        }

        // Mutable statuses — price is frozen once payment/completion starts
        const editable = [
          RequestStatus.PENDING,
          RequestStatus.REVIEWING,
          RequestStatus.WAITING_FOR_CUSTOMER,
          RequestStatus.IN_PROGRESS,
        ];
        if (!editable.includes(request.status as RequestStatus)) {
          throw new ConflictException(
            'در وضعیت فعلی امکان تغییر هزینه وجود ندارد (پس از اعلام مبلغ نهایی، قیمت قفل می‌شود)',
          );
        }

        // Lock the cost row
        const lockedCost = await tx.$queryRaw<Array<Record<string, unknown>>>(
          Prisma.sql`SELECT id, labor_fee, material_cost, additional_cost, discount_amount, final_total, currency FROM request_costs WHERE request_id = ${rid} FOR UPDATE`,
        );
        const current = lockedCost[0];
        if (!current) throw new NotFoundException('اطلاعات قیمت یافت نشد');

        const labor = Number(current.labor_fee);
        const materialBefore = Number(current.material_cost);
        const additionalBefore = Number(current.additional_cost);
        const discount = Number(current.discount_amount);
        const material =
          dto.materialCostToman !== undefined ? toMinor(dto.materialCostToman) : materialBefore;
        const additional =
          dto.additionalCostToman !== undefined
            ? toMinor(dto.additionalCostToman)
            : additionalBefore;

        // 5.2.3 — server-side total; 5.2.4 — reject negative
        const finalTotal = this.computeFinalTotal(labor, material, additional, discount);

        // Persist + histories in one shot (5.2.5)
        await tx.requestCost.update({
          where: { id: Number(current.id) },
          data: {
            materialCost: BigInt(material),
            additionalCost: BigInt(additional),
            finalTotal: BigInt(finalTotal),
          },
        });
        await tx.request.update({ where: { id: rid }, data: { finalTotal: BigInt(finalTotal) } });

        const historyRows = this.buildHistoryRows(
          Number(current.id),
          actor.id,
          dto.reason,
          ['material', 'additional'],
          [materialBefore, additionalBefore],
          [material, additional],
        );
        if (historyRows.length > 0) {
          await tx.requestCostHistory.createMany({ data: historyRows });
        }

        return {
          requestId: request.id,
          trackingCode: request.tracking_code,
          customerId: request.customer_id,
          assignedOperatorId: request.assigned_operator_id,
          previousTotal: Number(request.final_total),
          newTotal: finalTotal,
          labor,
          material,
          additional,
          discount,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      `Costs updated for ${result.trackingCode}: total ${result.previousTotal} → ${result.newTotal} (by ${actor.id})`,
    );

    // 5.2.6 — events (internal bus + Pusher), post-commit
    await this.emitPriceChanged(result, actor.id);
    await this.audit.log({
      userId: actor.id,
      action: AuditAction.PRICE_CHANGE,
      entity: 'request_costs',
      entityId: result.trackingCode,
      oldData: { finalTotal: toMajor(result.previousTotal) },
      newData: {
        finalTotal: toMajor(result.newTotal),
        materialCostToman: toMajor(result.material),
        additionalCostToman: toMajor(result.additional),
        reason: dto.reason ?? null,
      },
    });

    return {
      requestId: result.requestId.toString(),
      trackingCode: result.trackingCode,
      costs: {
        laborFee: toMajor(result.labor),
        materialCost: toMajor(result.material),
        additionalCost: toMajor(result.additional),
        discountAmount: toMajor(result.discount),
        finalTotal: toMajor(result.newTotal),
      },
      previousTotal: toMajor(result.previousTotal),
    };
  }

  // ==================== INTERNAL HELPERS (shared with Discounts) ====================

  /** 5.2.3 + 5.2.4 — integer-only final total; throws on negative. */
  computeFinalTotal(labor: number, material: number, additional: number, discount: number): number {
    const total = labor + material + additional - discount;
    if (total < 0) {
      throw new ConflictException('مبلغ نهایی نمی‌تواند منفی باشد — تخفیف را کاهش دهید');
    }
    return total;
  }

  /** Build RequestCostHistory rows for changed components only (5.2.5). */
  buildHistoryRows(
    costId: number,
    userId: string,
    reason: string | undefined,
    types: string[],
    before: number[],
    after: number[],
  ): CostHistoryRow[] {
    const rows: CostHistoryRow[] = [];
    types.forEach((type, i) => {
      if (!COST_CHANGE_TYPES.includes(type as never)) return;
      if ((before[i] ?? 0) === (after[i] ?? 0)) return;
      rows.push({
        requestCostId: costId,
        changeType: type,
        previousAmount: BigInt(before[i] ?? 0),
        newAmount: BigInt(after[i] ?? 0),
        userId: BigInt(userId),
        reason: reason?.trim() || undefined,
      });
    });
    return rows;
  }

  /** Post-commit event fan-out for a price change (5.2.6). */
  async emitPriceChanged(
    result: {
      requestId: bigint;
      trackingCode: string;
      customerId: bigint;
      assignedOperatorId: bigint | null;
      previousTotal: number;
      newTotal: number;
    },
    actorId: string,
  ): Promise<void> {
    const payload = {
      requestId: result.requestId.toString(),
      trackingCode: result.trackingCode,
      previousTotal: toMajor(result.previousTotal),
      newTotal: toMajor(result.newTotal),
      changedBy: actorId,
      at: new Date().toISOString(),
    };
    await this.events.emit(DOMAIN_EVENTS.REQUEST_PRICE_CHANGED, payload);
    await this.realtime.notifyRequestPriceChanged(result.requestId.toString(), {
      event: 'RequestPriceChanged',
      ...payload,
    });
    await this.realtime.notifyUser(result.customerId.toString(), 'RequestPriceChanged', payload);
    if (result.assignedOperatorId) {
      await this.realtime.notifyUser(
        result.assignedOperatorId.toString(),
        'RequestPriceChanged',
        payload,
      );
    }
  }

  /** Compute the discount amount a code yields for a subtotal (integer math). */
  computeDiscountAmount(
    type: string,
    value: number,
    subtotal: number,
    maxDiscountAmount: number | null,
  ): number {
    let amount: number;
    if (type === DiscountType.PERCENT) {
      amount = Math.floor((subtotal * value) / 100);
    } else {
      amount = value;
    }
    if (maxDiscountAmount !== null) amount = Math.min(amount, maxDiscountAmount);
    return Math.max(0, Math.min(amount, subtotal));
  }

  assertCanView(
    request: { customerId: bigint; assignedOperatorId: bigint | null },
    actor: CostActor,
  ): void {
    if (actor.roles.includes('admin')) return;
    if (request.customerId.toString() === actor.id) return;
    if (actor.roles.includes('operator') && request.assignedOperatorId?.toString() === actor.id) {
      return;
    }
    throw new ForbiddenException('شما به این درخواست دسترسی ندارید');
  }

  private toId(id: string): bigint {
    if (!/^\d+$/.test(id)) throw new BadRequestException('شناسه نامعتبر است');
    return BigInt(id);
  }

  private serializeCost(cost: Record<string, unknown>): Record<string, unknown> {
    const request = cost.request as Record<string, unknown> | undefined;
    return {
      requestId: request ? (request.id as bigint).toString() : undefined,
      trackingCode: request?.trackingCode,
      laborFee: toMajor(Number(cost.laborFee ?? 0n)),
      materialCost: toMajor(Number(cost.materialCost ?? 0n)),
      additionalCost: toMajor(Number(cost.additionalCost ?? 0n)),
      discountAmount: toMajor(Number(cost.discountAmount ?? 0n)),
      finalTotal: toMajor(Number(cost.finalTotal ?? 0n)),
      currency: cost.currency,
      createdAt: cost.createdAt,
      updatedAt: cost.updatedAt,
    };
  }
}
