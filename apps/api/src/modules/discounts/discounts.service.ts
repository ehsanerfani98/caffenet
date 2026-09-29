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
import { RequestCostsService } from '../pricing/request-costs.service';
import { toMajor, toMinor } from '../../common/utils/money';
import {
  AuditAction,
  DISCOUNT_CONFIG,
  DiscountType,
  DOMAIN_EVENTS,
  RequestStatus,
} from '@caffenet/shared';
import {
  ApplyDiscountDto,
  CreateDiscountDto,
  ListDiscountQueryDto,
  UpdateDiscountDto,
  ValidateDiscountDto,
} from './dto/discount.dto';

type Tx = Prisma.TransactionClient;

export interface DiscountActor {
  id: string;
  roles: string[];
}

/** Statuses in which the price (and therefore its discount) is still mutable. */
const DISCOUNT_EDITABLE_STATUSES = [
  RequestStatus.PENDING,
  RequestStatus.REVIEWING,
  RequestStatus.WAITING_FOR_CUSTOMER,
  RequestStatus.IN_PROGRESS,
];

/**
 * Discounts service — Phase 5.3 (+ 5.2.2 permission-gated application).
 *
 * Guarantees:
 *  - `apply` runs in a Serializable tx with SELECT … FOR UPDATE on the
 *    discount row → usage increment is atomic, race-proof (5.3.8).
 *  - ALL business checks happen INSIDE the tx: active flag, validity window,
 *    total usage limit, per-user usage limit, min order amount (5.3.6 / 5.3.7).
 *  - One discount per request — enforced by UNIQUE(request_id) on
 *    discount_usages + an in-tx re-check for friendly Persian errors.
 *  - Discount amount + final total are computed SERVER-SIDE with integer
 *    math; negative totals rejected (5.2.3 / 5.2.4).
 *  - Every mutation writes cost-history rows + `request.price_changed` event.
 */
@Injectable()
export class DiscountsService {
  private readonly logger = new Logger(DiscountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
    private readonly costs: RequestCostsService,
  ) {}

  // ==================== VALIDATE (5.3.3) ====================

  /**
   * Preview a discount code WITHOUT applying it.
   * With requestId → full preview against the request's current costs.
   * Without requestId → structural checks only (active / window / limits).
   */
  async validate(dto: ValidateDiscountDto, actor: DiscountActor) {
    const code = dto.code.trim();
    const discount = await this.prisma.discountCode.findUnique({ where: { code } });

    if (!discount) {
      return this.invalid('not_found', 'کد تخفیف یافت نشد');
    }

    const check = this.checkValidity(discount);
    if (check) return check;

    // Per-user limit (5.3.7) — checked for the caller when limits exist
    const userLimitCheck = await this.checkPerUserLimit(
      discount.id,
      discount.usageLimitPerUser,
      actor.id,
    );
    if (userLimitCheck) return userLimitCheck;

    // Preview against a concrete request
    if (dto.requestId !== undefined) {
      const rid = BigInt(dto.requestId);
      const request = await this.prisma.request.findUnique({
        where: { id: rid },
        select: { id: true, customerId: true, assignedOperatorId: true, trackingCode: true },
      });
      if (!request) throw new NotFoundException('درخواست یافت نشد');
      this.costs.assertCanView(request, actor);

      const cost = await this.prisma.requestCost.findUnique({ where: { requestId: rid } });
      if (!cost) throw new NotFoundException('اطلاعات قیمت درخواست یافت نشد');

      const existingUsage = await this.prisma.discountUsage.findUnique({
        where: { requestId: rid },
      });
      if (existingUsage) {
        return this.invalid('already_applied', 'قبلاً یک کد تخفیف روی این درخواست اعمال شده است');
      }

      const subtotal =
        Number(cost.laborFee) + Number(cost.materialCost) + Number(cost.additionalCost);
      const minCheck = this.checkMinOrder(discount, subtotal);
      if (minCheck) return minCheck;

      const discountAmount = this.costs.computeDiscountAmount(
        discount.type,
        Number(discount.value),
        subtotal,
        discount.maxDiscountAmount === null ? null : Number(discount.maxDiscountAmount),
      );
      return {
        valid: true,
        message: 'کد تخفیف معتبر است',
        discount: this.serializeDiscount(discount),
        preview: {
          subtotal: toMajor(subtotal),
          discountAmount: toMajor(discountAmount),
          finalTotal: toMajor(subtotal - discountAmount),
        },
      };
    }

    return {
      valid: true,
      message: 'کد تخفیف معتبر است',
      discount: this.serializeDiscount(discount),
    };
  }

  // ==================== APPLY (5.3.4 + 5.2.2 + 5.3.8) ====================

  /**
   * Lock a discount code to a request (permission `discounts.apply`).
   * Serializable tx + FOR UPDATE on the discount row → atomic used_count
   * increment; concurrent applies for the last remaining slot cannot both win.
   */
  async apply(requestId: string, dto: ApplyDiscountDto, actor: DiscountActor) {
    const isAdmin = actor.roles.includes('admin');
    const isOperator = actor.roles.includes('operator');
    if (!isAdmin && !isOperator) {
      throw new ForbiddenException('اعمال کد تخفیف فقط توسط اپراتور یا ادمین مجاز است');
    }

    const rid = BigInt(requestId);
    const result = await this.prisma.$transaction(
      async (tx) => {
        // 1) Lock the request row — status/authorization source
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
        if (!isAdmin && request.assigned_operator_id?.toString() !== actor.id) {
          throw new ForbiddenException('این درخواست به شما تخصیص نیافته است');
        }
        if (!DISCOUNT_EDITABLE_STATUSES.includes(request.status as RequestStatus)) {
          throw new ConflictException('در وضعیت فعلی امکان اعمال تخفیف وجود ندارد');
        }

        // 2) One discount per request — friendly check before the UNIQUE hit
        const existing = await tx.discountUsage.findUnique({ where: { requestId: rid } });
        if (existing) {
          throw new ConflictException('قبلاً یک کد تخفیف روی این درخواست اعمال شده است');
        }

        // 3) Lock the discount row (5.3.8 — atomic usage increment)
        const code = dto.code.trim();
        const lockedDiscount = await tx.$queryRaw<Array<Record<string, unknown>>>(
          Prisma.sql`SELECT id, code, type, value, min_order_amount, max_discount_amount, usage_limit, usage_limit_per_user, used_count, starts_at, expires_at, active FROM discount_codes WHERE code = ${code} FOR UPDATE`,
        );
        const discount = lockedDiscount[0];
        if (!discount) throw new NotFoundException('کد تخفیف یافت نشد');

        // 4) All business checks INSIDE the lock (5.3.6 / 5.3.7)
        const check = this.checkValidity(discount);
        if (check) throw new ConflictException(check.message);
        const usedCount = Number(discount.used_count);
        const usageLimit = discount.usage_limit === null ? null : Number(discount.usage_limit);
        if (usageLimit !== null && usedCount >= usageLimit) {
          throw new ConflictException('ظرفیت استفاده از این کد تخفیف تکمیل شده است');
        }
        const perUser =
          discount.usage_limit_per_user === null ? null : Number(discount.usage_limit_per_user);
        if (perUser !== null) {
          const userUsed = await tx.discountUsage.count({
            where: { discountId: Number(discount.id), userId: BigInt(actor.id) },
          });
          if (userUsed >= perUser) {
            throw new ConflictException('شما به سقف استفاده از این کد تخفیف رسیده‌اید');
          }
        }

        // 5) Compute amount against the CURRENT cost snapshot
        const lockedCost = await tx.$queryRaw<Array<Record<string, unknown>>>(
          Prisma.sql`SELECT id, labor_fee, material_cost, additional_cost, discount_amount, currency FROM request_costs WHERE request_id = ${rid} FOR UPDATE`,
        );
        const cost = lockedCost[0];
        if (!cost) throw new NotFoundException('اطلاعات قیمت درخواست یافت نشد');

        const labor = Number(cost.labor_fee);
        const material = Number(cost.material_cost);
        const additional = Number(cost.additional_cost);
        const subtotal = labor + material + additional;

        const minOrder =
          discount.min_order_amount === null ? null : Number(discount.min_order_amount);
        if (minOrder !== null && subtotal < minOrder) {
          throw new ConflictException(
            `حداقل مبلغ سفارش برای این کد ${toMajor(minOrder).toLocaleString('fa-IR')} تومان است`,
          );
        }

        const discountAmount = this.costs.computeDiscountAmount(
          String(discount.type),
          Number(discount.value),
          subtotal,
          discount.max_discount_amount === null ? null : Number(discount.max_discount_amount),
        );
        if (discountAmount <= 0) {
          throw new ConflictException('مبلغ تخفیف برای این سفارش صفر است');
        }

        // 5.2.3 / 5.2.4 — server-side total, reject negative
        const finalTotal = this.costs.computeFinalTotal(
          labor,
          material,
          additional,
          discountAmount,
        );

        // 6) Persist everything atomically: usage + counters + costs + history
        await tx.discountUsage.create({
          data: {
            discountId: Number(discount.id),
            requestId: rid,
            userId: BigInt(actor.id),
            amountSaved: BigInt(discountAmount),
          },
        });
        await tx.discountCode.update({
          where: { id: Number(discount.id) },
          data: { usedCount: { increment: 1 } },
        });
        await tx.requestCost.update({
          where: { id: Number(cost.id) },
          data: { discountAmount: BigInt(discountAmount), finalTotal: BigInt(finalTotal) },
        });
        await tx.request.update({ where: { id: rid }, data: { finalTotal: BigInt(finalTotal) } });
        await tx.requestCostHistory.create({
          data: {
            requestCostId: Number(cost.id),
            changeType: 'discount',
            previousAmount: Number(cost.discount_amount),
            newAmount: discountAmount,
            userId: BigInt(actor.id),
            reason: dto.reason?.trim() || `اعمال کد تخفیف ${String(discount.code)}`,
          },
        });

        return {
          requestId: request.id,
          trackingCode: request.tracking_code,
          customerId: request.customer_id,
          assignedOperatorId: request.assigned_operator_id,
          discountId: Number(discount.id),
          discountCode: String(discount.code),
          discountAmount,
          previousTotal: Number(request.final_total),
          newTotal: finalTotal,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      `Discount ${result.discountCode} applied to ${result.trackingCode}: −${result.discountAmount} (by ${actor.id})`,
    );

    // Post-commit events + audit (5.2.6)
    await this.costs.emitPriceChanged(result, actor.id);
    await this.realtime.notifyAdmins('DiscountApplied', {
      requestId: result.requestId.toString(),
      trackingCode: result.trackingCode,
      code: result.discountCode,
    });
    await this.audit.log({
      userId: actor.id,
      action: AuditAction.PRICE_CHANGE,
      entity: 'discount_usage',
      entityId: result.trackingCode,
      newData: {
        code: result.discountCode,
        discountAmount: toMajor(result.discountAmount),
        finalTotal: toMajor(result.newTotal),
        reason: dto.reason ?? null,
      },
    });

    return {
      requestId: result.requestId.toString(),
      trackingCode: result.trackingCode,
      discountCode: result.discountCode,
      discountAmount: toMajor(result.discountAmount),
      finalTotal: toMajor(result.newTotal),
      previousTotal: toMajor(result.previousTotal),
    };
  }

  // ==================== REMOVE (admin revert — pre-invoice only) ====================

  /** Remove an applied discount from a request (admin; before invoice exists). */
  async removeFromRequest(requestId: string, actor: DiscountActor) {
    if (!actor.roles.includes('admin')) {
      throw new ForbiddenException('حذف تخفیف اعمال‌شده فقط توسط ادمین مجاز است');
    }
    const rid = BigInt(requestId);
    const result = await this.prisma.$transaction(
      async (tx) => {
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
        if (!DISCOUNT_EDITABLE_STATUSES.includes(request.status as RequestStatus)) {
          throw new ConflictException('در وضعیت فعلی امکان حذف تخفیف وجود ندارد');
        }

        const usage = await tx.discountUsage.findUnique({ where: { requestId: rid } });
        if (!usage) throw new NotFoundException('تخفیفی روی این درخواست اعمال نشده است');

        const lockedCost = await tx.$queryRaw<Array<Record<string, unknown>>>(
          Prisma.sql`SELECT id, labor_fee, material_cost, additional_cost FROM request_costs WHERE request_id = ${rid} FOR UPDATE`,
        );
        const cost = lockedCost[0];
        if (!cost) throw new NotFoundException('اطلاعات قیمت درخواست یافت نشد');

        const labor = Number(cost.labor_fee);
        const material = Number(cost.material_cost);
        const additional = Number(cost.additional_cost);
        const newTotal = this.costs.computeFinalTotal(labor, material, additional, 0);

        await tx.discountUsage.delete({ where: { id: usage.id } });
        await tx.discountCode.update({
          where: { id: usage.discountId },
          data: { usedCount: { decrement: 1 } },
        });
        await tx.requestCost.update({
          where: { id: Number(cost.id) },
          data: { discountAmount: 0n, finalTotal: BigInt(newTotal) },
        });
        await tx.request.update({ where: { id: rid }, data: { finalTotal: BigInt(newTotal) } });
        await tx.requestCostHistory.create({
          data: {
            requestCostId: Number(cost.id),
            changeType: 'discount',
            previousAmount: Number(usage.amountSaved),
            newAmount: 0,
            userId: BigInt(actor.id),
            reason: 'حذف کد تخفیف توسط ادمین',
          },
        });

        return {
          requestId: request.id,
          trackingCode: request.tracking_code,
          customerId: request.customer_id,
          assignedOperatorId: request.assigned_operator_id,
          previousTotal: Number(request.final_total),
          newTotal,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.costs.emitPriceChanged(result, actor.id);
    await this.audit.log({
      userId: actor.id,
      action: AuditAction.PRICE_CHANGE,
      entity: 'discount_usage',
      entityId: result.trackingCode,
      oldData: { finalTotal: toMajor(result.previousTotal) },
      newData: { finalTotal: toMajor(result.newTotal), removed: true },
    });

    return {
      requestId: result.requestId.toString(),
      trackingCode: result.trackingCode,
      removed: true,
      finalTotal: toMajor(result.newTotal),
    };
  }

  // ==================== ADMIN CRUD (5.3.5) ====================

  async create(dto: CreateDiscountDto, actor: DiscountActor) {
    // Value semantics per type
    if (dto.type === DiscountType.PERCENT) {
      if (
        dto.valueToman < DISCOUNT_CONFIG.MIN_PERCENT_VALUE ||
        dto.valueToman > DISCOUNT_CONFIG.MAX_PERCENT_VALUE
      ) {
        throw new BadRequestException(
          `مقدار تخفیف درصدی باید بین ${DISCOUNT_CONFIG.MIN_PERCENT_VALUE} تا ${DISCOUNT_CONFIG.MAX_PERCENT_VALUE} باشد`,
        );
      }
    }
    const startsAt = new Date(dto.startsAt);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= startsAt) {
      throw new BadRequestException('تاریخ پایان باید بعد از تاریخ شروع باشد');
    }

    try {
      const created = await this.prisma.discountCode.create({
        data: {
          code: dto.code.trim(),
          type: dto.type,
          value: BigInt(
            dto.type === DiscountType.PERCENT ? dto.valueToman : toMinor(dto.valueToman),
          ),
          minOrderAmount:
            dto.minOrderAmountToman === undefined || dto.minOrderAmountToman === null
              ? null
              : BigInt(toMinor(dto.minOrderAmountToman)),
          maxDiscountAmount:
            dto.maxDiscountAmountToman === undefined || dto.maxDiscountAmountToman === null
              ? null
              : BigInt(toMinor(dto.maxDiscountAmountToman)),
          usageLimit: dto.usageLimit ?? null,
          usageLimitPerUser: dto.usageLimitPerUser ?? null,
          startsAt,
          expiresAt,
          active: dto.active ?? true,
        },
      });
      await this.audit.log({
        userId: actor.id,
        action: AuditAction.CREATE,
        entity: 'discount_code',
        entityId: created.code,
        newData: { type: created.type, value: Number(created.value) },
      });
      return this.serializeDiscount(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('این کد تخفیف قبلاً ثبت شده است');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateDiscountDto, actor: DiscountActor) {
    const existing = await this.prisma.discountCode.findUnique({ where: { id: this.toId(id) } });
    if (!existing) throw new NotFoundException('کد تخفیف یافت نشد');

    const data: Record<string, unknown> = {};
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.valueToman !== undefined) {
      data.value = BigInt(
        existing.type === DiscountType.PERCENT ? dto.valueToman : toMinor(dto.valueToman),
      );
      if (
        existing.type === DiscountType.PERCENT &&
        (dto.valueToman < DISCOUNT_CONFIG.MIN_PERCENT_VALUE ||
          dto.valueToman > DISCOUNT_CONFIG.MAX_PERCENT_VALUE)
      ) {
        throw new BadRequestException('مقدار تخفیف درصدی باید بین ۱ تا ۱۰۰ باشد');
      }
    }
    if (dto.minOrderAmountToman !== undefined)
      data.minOrderAmount =
        dto.minOrderAmountToman === null ? null : BigInt(toMinor(dto.minOrderAmountToman));
    if (dto.maxDiscountAmountToman !== undefined)
      data.maxDiscountAmount =
        dto.maxDiscountAmountToman === null ? null : BigInt(toMinor(dto.maxDiscountAmountToman));
    if (dto.usageLimit !== undefined) data.usageLimit = dto.usageLimit;
    if (dto.usageLimitPerUser !== undefined) data.usageLimitPerUser = dto.usageLimitPerUser;
    if (dto.expiresAt !== undefined)
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const updated = await this.prisma.discountCode.update({
      where: { id: existing.id },
      data,
    });
    await this.audit.log({
      userId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'discount_code',
      entityId: existing.code,
      oldData: { active: existing.active, value: Number(existing.value) },
      newData: { active: updated.active, value: Number(updated.value) },
    });
    return this.serializeDiscount(updated);
  }

  async remove(id: string, actor: DiscountActor) {
    const existing = await this.prisma.discountCode.findUnique({
      where: { id: this.toId(id) },
      include: { _count: { select: { usages: true } } },
    });
    if (!existing) throw new NotFoundException('کد تخفیف یافت نشد');
    if (existing.usedCount > 0 || existing._count.usages > 0) {
      // Preserve financial audit trail — deactivate instead of deleting
      throw new ConflictException(
        'این کد تخفیف استفاده شده است و حذف آن امکان‌پذیر نیست — می‌توانید آن را غیرفعال کنید',
      );
    }
    await this.prisma.discountCode.delete({ where: { id: existing.id } });
    await this.audit.log({
      userId: actor.id,
      action: AuditAction.DELETE,
      entity: 'discount_code',
      entityId: existing.code,
      oldData: { code: existing.code },
    });
    return { deleted: true, code: existing.code };
  }

  async list(query: ListDiscountQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: Record<string, unknown> = {};
    if (query.active === 'active') where.active = true;
    if (query.active === 'inactive') where.active = false;
    if (query.search) where.code = { contains: query.search.trim() };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.discountCode.count({ where }),
      this.prisma.discountCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);
    return {
      items: rows.map((r) => this.serializeDiscount(r)),
      meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  async getUsages(discountId: string) {
    const discount = await this.prisma.discountCode.findUnique({
      where: { id: this.toId(discountId) },
      include: {
        usages: { orderBy: { appliedAt: 'desc' }, take: 100 },
      },
    });
    if (!discount) throw new NotFoundException('کد تخفیف یافت نشد');
    return {
      discount: this.serializeDiscount(discount),
      usages: discount.usages.map((u) => ({
        id: u.id.toString(),
        discountId: u.discountId.toString(),
        requestId: u.requestId.toString(),
        userId: u.userId.toString(),
        amountSaved: toMajor(Number(u.amountSaved)),
        usedAt: u.appliedAt,
      })),
    };
  }

  // ==================== VALIDATION HELPERS (5.3.6 / 5.3.7) ====================

  /** Shared validity checks — returns an error result or null when valid. */
  private checkValidity(
    d: Record<string, unknown>,
  ): { valid: false; code: string; message: string } | null {
    const now = new Date();
    if (d.active === false) return this.invalid('inactive', 'این کد تخفیف غیرفعال است');
    const startsAt = d.starts_at ?? d.startsAt;
    const expiresAt = d.expires_at ?? d.expiresAt;
    if (startsAt && new Date(startsAt as Date) > now) {
      return this.invalid('not_started', 'این کد تخفیف هنوز فعال نشده است');
    }
    if (expiresAt && new Date(expiresAt as Date) <= now) {
      return this.invalid('expired', 'مهلت استفاده از این کد تخفیف به پایان رسیده است');
    }
    const usedCount = Number(d.used_count ?? d.usedCount ?? 0);
    const usageLimit = d.usage_limit ?? d.usageLimit;
    if (usageLimit !== null && usageLimit !== undefined && usedCount >= Number(usageLimit)) {
      return this.invalid('usage_limit_reached', 'ظرفیت استفاده از این کد تخفیف تکمیل شده است');
    }
    return null;
  }

  private async checkPerUserLimit(
    discountId: bigint | number,
    perUser: number | null | undefined,
    userId: string,
  ) {
    if (perUser === null || perUser === undefined) return null;
    const used = await this.prisma.discountUsage.count({
      where: { discountId: BigInt(discountId), userId: BigInt(userId) },
    });
    if (used >= perUser) {
      return this.invalid('per_user_limit_reached', 'شما به سقف استفاده از این کد تخفیف رسیده‌اید');
    }
    return null;
  }

  private checkMinOrder(d: Record<string, unknown>, subtotal: number) {
    const minOrderAmount = d.min_order_amount ?? d.minOrderAmount;
    if (
      minOrderAmount !== null &&
      minOrderAmount !== undefined &&
      subtotal < Number(minOrderAmount)
    ) {
      return this.invalid(
        'min_order_not_met',
        `حداقل مبلغ سفارش برای این کد ${toMajor(Number(minOrderAmount)).toLocaleString('fa-IR')} تومان است`,
      );
    }
    return null;
  }

  private invalid(code: string, message: string): { valid: false; code: string; message: string } {
    return { valid: false as const, code, message };
  }

  // ==================== SERIALIZATION ====================

  private serializeDiscount(d: Record<string, unknown>): Record<string, unknown> {
    return {
      id: (d.id as bigint).toString(),
      uuid: d.uuid,
      code: d.code,
      type: d.type,
      value: d.type === DiscountType.PERCENT ? Number(d.value) : toMajor(Number(d.value)),
      currency: d.currency,
      minOrderAmount:
        d.minOrderAmount === null || d.minOrderAmount === undefined
          ? null
          : toMajor(Number(d.minOrderAmount)),
      maxDiscountAmount:
        d.maxDiscountAmount === null || d.maxDiscountAmount === undefined
          ? null
          : toMajor(Number(d.maxDiscountAmount)),
      usageLimit: d.usageLimit ?? null,
      usageLimitPerUser: d.usageLimitPerUser ?? null,
      usedCount: Number(d.usedCount ?? 0),
      startsAt: d.startsAt,
      expiresAt: d.expiresAt ?? null,
      active: d.active,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  private toId(id: string): bigint {
    if (!/^\d+$/.test(id)) throw new BadRequestException('شناسه نامعتبر است');
    return BigInt(id);
  }
}
