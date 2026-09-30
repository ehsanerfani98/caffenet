import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { WalletService } from '../wallet/wallet.service';
import {
  DOMAIN_EVENTS,
  PUSHER_CONFIG,
  PAYMENT_CONFIG,
  PaymentGatewayName,
  PaymentRecordStatus,
  CurrencyHelper,
} from '@caffenet/shared';
import { PaymentGateway, GatewayVerifyResult } from './payment-gateway.interface';
import { ZarinpalGateway } from './gateways/zarinpal.gateway';
import { ZibalGateway } from './gateways/zibal.gateway';
import { SettingsService } from '../../config/settings.service';

/**
 * PaymentsService (Phase 6.4) — online payment orchestration.
 *
 * Flow (6.4.6 → 6.4.12):
 *   create → gateway.createPayment → store authority (pending)
 *   callback → log raw → verify SERVER-SIDE → atomic wallet settle
 *
 * Idempotency (6.4.9):
 *   - Payment rows carry a UNIQUE idempotency_key
 *   - verify() is a state machine: pending/verifying → successful | failed
 *     Re-callbacks on a successful payment return the stored result without
 *     re-crediting the wallet (the deposit ledger key is unique per payment).
 *
 * NEVER trust client callback fields for money movement — the gateway's
 * verify API is the only source of truth (6.4.8).
 */

interface CreatePaymentParams {
  userId: string;
  /** Toman (major units) */
  amountToman: number;
  gateway?: PaymentGatewayName;
  requestId?: string | null;
  description?: string;
  mobile?: string | null;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly gateways: Map<string, PaymentGateway>;
  private readonly defaultGateway: PaymentGatewayName;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly events: EventBusService,
    private readonly realtime: RealtimeService,
    private readonly settings: SettingsService,
    config: ConfigService,
  ) {
    const zarinpal = new ZarinpalGateway(this.settings);
    const zibal = new ZibalGateway(this.settings);
    this.gateways = new Map<string, PaymentGateway>([
      [zarinpal.name, zarinpal],
      [zibal.name, zibal],
    ]);
    this.defaultGateway = config.get<PaymentGatewayName>(
      'PAYMENT_DEFAULT_GATEWAY',
      PaymentGatewayName.ZARINPAL,
    )!;
  }

  // ==========================================================================
  // 6.4.6 — create payment (wallet top-up or request payment)
  // ==========================================================================

  async createPayment(params: CreatePaymentParams) {
    const gatewayName = params.gateway ?? this.defaultGateway;
    const gateway = this.gateways.get(gatewayName);
    if (!gateway) {
      throw new BadRequestException(`درگاه پرداخت «${gatewayName}» پشتیبانی نمی‌شود`);
    }
    if (!Number.isInteger(params.amountToman) || params.amountToman <= 0) {
      throw new BadRequestException('مبلغ پرداخت نامعتبر است');
    }
    const amountMinor = BigInt(CurrencyHelper.toMinor(params.amountToman));

    // Optional request binding — validate ownership + state
    let request = null;
    if (params.requestId) {
      request = await this.prisma.request.findUnique({
        where: { id: BigInt(params.requestId) },
      });
      if (!request) throw new NotFoundException('درخواست یافت نشد');
      if (request.customerId !== BigInt(params.userId)) {
        throw new ForbiddenException('این درخواست متعلق به شما نیست');
      }
      if (request.status !== 'waiting_for_payment') {
        throw new ConflictException({
          code: 'INVALID_REQUEST_STATUS',
          message: 'درخواست در وضعیت قابل پرداخت نیست',
        });
      }
      // Reject double payment (6.5.4): any successful/verifying payment for
      // this request blocks a second one.
      const existing = await this.prisma.payment.findFirst({
        where: { requestId: BigInt(params.requestId), status: { in: ['successful', 'verifying'] } },
      });
      if (existing) {
        throw new ConflictException({
          code: 'PAYMENT_ALREADY_IN_PROGRESS',
          message: 'برای این درخواست پرداخت در جریان است یا انجام شده است',
        });
      }
    }

    // Create local payment record (pending) then call the gateway
    const wallet = await this.wallet.getOrCreateWallet(params.userId);
    const idempotencyKey = `payment:${gatewayName}:${params.userId}:${Date.now()}:${Math.floor(Math.random() * 1e9)}`;

    const payment = await this.prisma.payment.create({
      data: {
        userId: BigInt(params.userId),
        walletId: wallet.id,
        requestId: request ? request.id : null,
        amount: amountMinor,
        gateway: gatewayName,
        status: PaymentRecordStatus.PENDING,
        idempotencyKey,
      },
    });

    const callbackUrl = this.buildCallbackUrl(payment.id.toString());
    let gatewayResult;
    try {
      gatewayResult = await gateway.createPayment({
        amountMinor,
        orderId: payment.id.toString(),
        description:
          params.description ??
          (request ? `پرداخت درخواست ${request.trackingCode}` : 'شارژ کیف پول کافه‌نت'),
        callbackUrl,
        mobile: params.mobile ?? null,
      });
    } catch (e) {
      // Gateway unreachable / rejected → do not leave a dangling pending record
      await this.prisma.payment
        .update({
          where: { id: payment.id },
          data: { status: PaymentRecordStatus.FAILED, failedAt: new Date() },
        })
        .catch(() => undefined);
      throw new BadRequestException(`ایجاد پرداخت در درگاه ناموفق بود: ${(e as Error).message}`);
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        authority: gatewayResult.authority,
        metadata: {
          gatewayCreateRaw: gatewayResult.raw ?? null,
          callbackUrl,
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Payment created: #${payment.id} (${gatewayName}, ${amountMinor} minor, request=${params.requestId ?? '-'})`,
    );

    return {
      payment: this.toPaymentDto(updated),
      redirectUrl: gatewayResult.redirectUrl,
    };
  }

  // ==========================================================================
  // 6.4.8 — gateway callback (GET, public) + server-side verify
  // ==========================================================================

  /**
   * Handles the gateway redirect. Logs the raw callback, verifies with the
   * gateway server-side and settles the wallet atomically. Idempotent.
   */
  async handleCallback(params: {
    query: Record<string, string | undefined>;
    method: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
    userAgent?: string;
  }) {
    const q = params.query ?? {};
    const authority = q.Authority ?? q.authority ?? q.trackId ?? q.trackid ?? '';
    const clientStatus = q.Status ?? q.status ?? q.success ?? '';

    // 6.4.2 — log the raw callback no matter what
    const callbackLog = await this.logCallback(params, authority);

    if (!authority) {
      await this.failCallbackLog(callbackLog.id, 'missing authority');
      throw new BadRequestException('پارامترهای بازگشت پرداخت نامعتبر است');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { authority },
    });
    if (!payment) {
      await this.failCallbackLog(callbackLog.id, `payment not found for authority=${authority}`);
      throw new NotFoundException('پرداخت یافت نشد');
    }

    try {
      const result = await this.verifyAndSettle(payment.id.toString());
      await this.prisma.paymentCallback.update({
        where: { id: callbackLog.id },
        data: { processedAt: new Date(), result: 'success' },
      });
      return result;
    } catch (e) {
      await this.prisma.paymentCallback.update({
        where: { id: callbackLog.id },
        data: { processedAt: new Date(), result: 'failed', errorMessage: (e as Error).message },
      });
      throw e;
    }
  }

  /**
   * Verify a payment (server-side) and settle the wallet. Safe to call
   * multiple times — re-verification returns the stored outcome.
   */
  async verifyAndSettle(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: BigInt(paymentId) },
      include: { request: { select: { id: true, status: true } } },
    });
    if (!payment) throw new NotFoundException('پرداخت یافت نشد');

    // Idempotent fast-path (6.4.9)
    if (payment.status === PaymentRecordStatus.SUCCESSFUL) {
      return {
        payment: this.toPaymentDto(payment),
        state: 'already_verified' as const,
        message: 'پرداخت قبلاً تأیید و تسویه شده است',
      };
    }
    if (payment.status === PaymentRecordStatus.REFUNDED) {
      throw new ConflictException('پرداخت بازگشت داده شده است');
    }

    const gateway = this.gateways.get(payment.gateway);
    if (!gateway) throw new Error(`unknown gateway ${payment.gateway}`);

    // Mark verifying to shrink the race window between parallel verifies
    const claimed = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: { in: [PaymentRecordStatus.PENDING, PaymentRecordStatus.FAILED] },
      },
      data: { status: PaymentRecordStatus.VERIFYING },
    });
    if (claimed.count === 0 && payment.status !== PaymentRecordStatus.VERIFYING) {
      const fresh = await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      if (fresh.status === PaymentRecordStatus.SUCCESSFUL) {
        return {
          payment: this.toPaymentDto(fresh),
          state: 'already_verified' as const,
          message: 'پرداخت قبلاً تأیید و تسویه شده است',
        };
      }
    }

    let verifyResult: GatewayVerifyResult;
    try {
      verifyResult = await gateway.verifyPayment({
        authority: payment.authority!,
        amountMinor: payment.amount,
      });
    } catch (e) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentRecordStatus.FAILED, failedAt: new Date() },
      });
      await this.emitPaymentFailed(payment, (e as Error).message);
      throw new BadRequestException('تأیید پرداخت در درگاه ناموفق بود');
    }

    if (!verifyResult.success) {
      // 6.4.12 — failure path
      const failed = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentRecordStatus.FAILED,
          failedAt: new Date(),
          metadata: {
            ...((payment.metadata as Record<string, unknown> | null) ?? {}),
            verifyRaw: verifyResult.raw ?? null,
          } as Prisma.InputJsonValue,
        },
      });
      await this.emitPaymentFailed(failed, verifyResult.message);
      return {
        payment: this.toPaymentDto(failed),
        state: 'failed' as const,
        message: verifyResult.message ?? 'پرداخت ناموفق بود',
      };
    }

    // Success — persist reference + metadata first, then settle wallet atomically
    const successful = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentRecordStatus.SUCCESSFUL,
        paidAt: payment.paidAt ?? new Date(),
        referenceNumber: verifyResult.referenceNumber ?? null,
        metadata: {
          ...((payment.metadata as Record<string, unknown> | null) ?? {}),
          verifyRaw: verifyResult.raw ?? null,
          cardPan: verifyResult.cardPan ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    // 6.4.11 — atomic deposit (+ optional request settlement) in ONE tx
    const balanceAfter = await this.wallet.settlePayment({
      userId: payment.userId.toString(),
      paymentId: payment.id.toString(),
      amountMinor: payment.amount,
      requestId: payment.requestId ? payment.requestId.toString() : null,
    });

    this.logger.log(
      `Payment verified: #${payment.id} ref=${verifyResult.referenceNumber} settled (balance=${balanceAfter})`,
    );

    // Events (6.4.11)
    await this.events.emit(DOMAIN_EVENTS.PAYMENT_COMPLETED, {
      paymentId: payment.id.toString(),
      userId: payment.userId.toString(),
      requestId: payment.requestId?.toString() ?? null,
      amount: CurrencyHelper.toMajor(Number(payment.amount)),
      gateway: payment.gateway,
      referenceNumber: verifyResult.referenceNumber ?? null,
      at: new Date().toISOString(),
    });
    await this.realtime
      .notifyUser(payment.userId.toString(), 'PaymentCompleted', {
        paymentId: payment.id.toString(),
        amount: CurrencyHelper.toMajor(Number(payment.amount)),
      })
      .catch(() => undefined);
    if (payment.requestId) {
      await this.realtime
        .notifyRequestStatusChanged(payment.requestId.toString(), { status: 'paid' })
        .catch(() => undefined);
    }

    return {
      payment: this.toPaymentDto(successful),
      state: verifyResult.state,
      message: 'پرداخت با موفقیت تأیید و تسویه شد',
    };
  }

  /** 6.4.10 — manual re-verify (admin/operator or customer retry). */
  async manualVerify(paymentId: string, actorUserId: string, isAdmin: boolean) {
    const payment = await this.prisma.payment.findUnique({ where: { id: BigInt(paymentId) } });
    if (!payment) throw new NotFoundException('پرداخت یافت نشد');
    if (!isAdmin && payment.userId !== BigInt(actorUserId)) {
      throw new ForbiddenException('اجازه دسترسی به این پرداخت را ندارید');
    }
    return this.verifyAndSettle(paymentId);
  }

  // ==========================================================================
  // Reads
  // ==========================================================================

  async findById(paymentId: string, actorUserId: string, isAdmin: boolean) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: BigInt(paymentId) },
      include: { request: { select: { trackingCode: true } } },
    });
    if (!payment) throw new NotFoundException('پرداخت یافت نشد');
    if (!isAdmin && payment.userId !== BigInt(actorUserId)) {
      throw new ForbiddenException('اجازه دسترسی به این پرداخت را ندارید');
    }
    return this.toPaymentDto(payment, payment.request?.trackingCode);
  }

  async listMine(userId: string, page = 1, limit = 20) {
    const where = { userId: BigInt(userId) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { request: { select: { trackingCode: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toPaymentDto(r, r.request?.trackingCode)),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ==========================================================================
  // Internals
  // ==========================================================================

  private buildCallbackUrl(paymentId: string): string {
    // The gateway redirects the customer's browser here; we bind the payment
    // id in the query so the public callback endpoint can find it even if the
    // gateway drops its own authority parameter.
    const base = this.callbackBase;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}paymentId=${paymentId}`;
  }

  private get callbackBase(): string {
    // ZARINPAL_CALLBACK_URL doubles as the app's public payments callback
    // (set by deployment config); falls back to a local URL in dev.
    const configured = process.env.ZARINPAL_CALLBACK_URL ?? '';
    if (configured) return configured;
    return 'http://localhost:3001/api/v1/payments/callback';
  }

  private async logCallback(
    params: {
      query: Record<string, string | undefined>;
      method: string;
      path: string;
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
      userAgent?: string;
    },
    authority: string,
  ) {
    const payment = await this.prisma.payment.findFirst({ where: { authority } });
    return this.prisma.paymentCallback.create({
      data: {
        paymentId: payment?.id ?? null,
        method: params.method.slice(0, 10),
        path: params.path.slice(0, 255),
        query: params.query as Prisma.InputJsonValue,
        body: Prisma.JsonNull,
        headers: params.headers as Prisma.InputJsonValue,
        ip: params.ip ?? null,
        userAgent: params.userAgent?.slice(0, 500) ?? null,
      },
    });
  }

  private async failCallbackLog(callbackId: bigint, message: string) {
    await this.prisma.paymentCallback
      .update({
        where: { id: callbackId },
        data: { processedAt: new Date(), result: 'failed', errorMessage: message },
      })
      .catch(() => undefined);
  }

  private async emitPaymentFailed(
    payment: {
      id: bigint;
      userId: bigint;
      requestId: bigint | null;
      amount: bigint;
      gateway: string;
    },
    message?: string,
  ) {
    await this.events.emit(DOMAIN_EVENTS.PAYMENT_FAILED, {
      paymentId: payment.id.toString(),
      userId: payment.userId.toString(),
      requestId: payment.requestId?.toString() ?? null,
      amount: CurrencyHelper.toMajor(Number(payment.amount)),
      gateway: payment.gateway,
      reason: message,
      at: new Date().toISOString(),
    });
    await this.realtime
      .notifyUser(payment.userId.toString(), 'PaymentFailed', {
        paymentId: payment.id.toString(),
        reason: message,
      })
      .catch(() => undefined);
  }

  toPaymentDto(
    p: {
      id: bigint;
      uuid: string;
      userId: bigint;
      walletId: bigint | null;
      requestId: bigint | null;
      amount: bigint;
      currency: string;
      gateway: string;
      status: string;
      authority: string | null;
      referenceNumber: string | null;
      paidAt: Date | null;
      failedAt: Date | null;
      refundedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    requestTrackingCode?: string,
  ) {
    return {
      id: p.id.toString(),
      uuid: p.uuid,
      userId: p.userId.toString(),
      walletId: p.walletId?.toString() ?? null,
      requestId: p.requestId?.toString() ?? null,
      requestTrackingCode,
      amount: CurrencyHelper.toMajor(Number(p.amount)),
      currency: p.currency,
      gateway: p.gateway,
      status: p.status,
      authority: p.authority,
      referenceNumber: p.referenceNumber,
      paidAt: p.paidAt?.toISOString() ?? null,
      failedAt: p.failedAt?.toISOString() ?? null,
      refundedAt: p.refundedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
