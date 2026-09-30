/**
 * NotificationEventListener (Phase 11.5) — auto-fired notifications.
 *
 * Subscribes to domain events on the internal event bus and fans out typed
 * notifications according to TASKS.md 11.5:
 *
 *   request.created       → operators                (11.5.1)
 *   request.assigned      → customer                 (11.5.2)
 *   request.status_changed→ customer (completed → REQUEST_COMPLETED 11.5.10,
 *                                     cancelled → REQUEST_CANCELLED,
 *                                     otherwise REQUEST_STATUS_CHANGED 11.5.3)
 *   request.price_changed → customer                 (11.5.4)
 *   message.sent          → handled directly in ChatService (11.5.5) to reuse
 *                            the computed recipient list + preview
 *   payment.completed     → customer + admins        (11.5.6)
 *   payment.failed        → customer                 (11.5.7)
 *   wallet.charged        → customer                 (11.5.8)
 *   wallet.refunded       → customer                 (11.5.9)
 *
 * Listener failures are logged and swallowed — notifications never break the
 * originating business flow.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DOMAIN_EVENTS, NotificationType, RequestStatus } from '@caffenet/shared';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationEventListener implements OnModuleInit {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    this.logger.log('NotificationEventListener registered — auto-fired notifications active');
  }

  // ---- 11.5.1 RequestCreated → operators -----------------------------------
  @OnEvent(DOMAIN_EVENTS.REQUEST_CREATED)
  async handleRequestCreated(payload: {
    requestId?: string;
    trackingCode?: string;
    customerId?: string;
    serviceId?: string;
    serviceName?: string;
  }) {
    if (!payload?.requestId) return;
    await this.notifications
      .sendToRole('operator', NotificationType.REQUEST_CREATED, {
        requestId: payload.requestId,
        trackingCode: payload.trackingCode,
        serviceName: payload.serviceName,
        // Operators act from the operator dashboard
        link: `/operator/requests/${payload.requestId}`,
      })
      .catch((e: unknown) => this.logFail('request.created', e));
  }

  // ---- 11.5.2 RequestAssigned → customer -----------------------------------
  @OnEvent(DOMAIN_EVENTS.REQUEST_ASSIGNED)
  async handleRequestAssigned(payload: {
    requestId?: string;
    trackingCode?: string;
    operatorId?: string;
    operatorName?: string;
  }) {
    if (!payload?.requestId) return;
    const request = await this.prisma.request.findUnique({
      where: { id: BigInt(payload.requestId) },
      select: { customerId: true, trackingCode: true },
    });
    if (!request) return;
    await this.notifications
      .send(request.customerId.toString(), NotificationType.REQUEST_ASSIGNED, {
        requestId: payload.requestId,
        trackingCode: payload.trackingCode ?? request.trackingCode,
        operatorName: payload.operatorName,
      })
      .catch((e: unknown) => this.logFail('request.assigned', e));
  }

  // ---- 11.5.3 / 11.5.10 RequestStatusChanged → customer ---------------------
  // Payload shapes vary by emitter (workflow / cancel / wallet settle) —
  // normalize status + actor here.
  @OnEvent(DOMAIN_EVENTS.REQUEST_STATUS_CHANGED)
  async handleRequestStatusChanged(payload: {
    requestId?: string;
    trackingCode?: string;
    previousStatus?: string;
    status?: string;
    newStatus?: string;
    statusFa?: string;
    note?: string | null;
    reason?: string | null;
    changedBy?: string;
    userId?: string;
    by?: string;
  }) {
    if (!payload?.requestId) return;
    const status = payload.status ?? payload.newStatus;
    if (!status) return;

    const request = await this.prisma.request.findUnique({
      where: { id: BigInt(payload.requestId) },
      select: { customerId: true, trackingCode: true },
    });
    if (!request) return;

    // Do not notify the customer about a status change they caused themselves
    // (e.g. self-cancellation) — actor id arrives as changedBy/userId/by.
    const actor = payload.changedBy ?? payload.userId ?? payload.by;
    if (actor && actor === request.customerId.toString()) return;

    const base = {
      requestId: payload.requestId,
      trackingCode: payload.trackingCode ?? request.trackingCode,
      status,
      statusFa: payload.statusFa,
      note: payload.note ?? payload.reason ?? null,
    };

    if (status === RequestStatus.COMPLETED) {
      // 11.5.10 — dedicated completed notification
      await this.notifications
        .send(request.customerId.toString(), NotificationType.REQUEST_COMPLETED, base)
        .catch((e: unknown) => this.logFail('request.completed', e));
      return;
    }
    if (status === RequestStatus.CANCELLED) {
      await this.notifications
        .send(request.customerId.toString(), NotificationType.REQUEST_CANCELLED, base)
        .catch((e: unknown) => this.logFail('request.cancelled', e));
      return;
    }
    await this.notifications
      .send(request.customerId.toString(), NotificationType.REQUEST_STATUS_CHANGED, base)
      .catch((e: unknown) => this.logFail('request.status_changed', e));
  }

  // ---- 11.5.4 RequestPriceChanged → customer --------------------------------
  @OnEvent(DOMAIN_EVENTS.REQUEST_PRICE_CHANGED)
  async handleRequestPriceChanged(payload: {
    requestId?: string;
    trackingCode?: string;
    previousTotal?: number;
    newTotal?: number;
  }) {
    if (!payload?.requestId) return;
    const request = await this.prisma.request.findUnique({
      where: { id: BigInt(payload.requestId) },
      select: { customerId: true, trackingCode: true },
    });
    if (!request) return;
    await this.notifications
      .send(request.customerId.toString(), NotificationType.REQUEST_PRICE_CHANGED, {
        requestId: payload.requestId,
        trackingCode: payload.trackingCode ?? request.trackingCode,
        previousTotal: payload.previousTotal,
        newTotal: payload.newTotal,
      })
      .catch((e: unknown) => this.logFail('request.price_changed', e));
  }

  // ---- 11.5.6 PaymentCompleted → customer + admins ---------------------------
  @OnEvent(DOMAIN_EVENTS.PAYMENT_COMPLETED)
  async handlePaymentCompleted(payload: {
    paymentId?: string;
    userId?: string;
    requestId?: string | null;
    amount?: number;
    gateway?: string;
    trackingCode?: string;
  }) {
    if (!payload?.userId) return;

    // Customer copy — resolve trackingCode when the payment settled a request
    let trackingCode = payload.trackingCode;
    if (!trackingCode && payload.requestId) {
      const req = await this.prisma.request.findUnique({
        where: { id: BigInt(payload.requestId) },
        select: { trackingCode: true },
      });
      trackingCode = req?.trackingCode;
    }
    await this.notifications
      .send(payload.userId, NotificationType.PAYMENT_SUCCESSFUL, {
        paymentId: payload.paymentId,
        requestId: payload.requestId ?? undefined,
        amount: payload.amount,
        trackingCode,
      })
      .catch((e: unknown) => this.logFail('payment.completed', e));

    // Admin copies — money movement visibility (skip the admin who acted)
    await this.notifications
      .sendToRole('admin', NotificationType.PAYMENT_SUCCESSFUL, {
        title: `پرداخت ${payload.amount ?? 0} تومانی ثبت شد`,
        paymentId: payload.paymentId,
        requestId: payload.requestId ?? undefined,
        amount: payload.amount,
        gateway: payload.gateway,
        userId: payload.userId,
        link: '/admin/finance',
      })
      .catch((e: unknown) => this.logFail('payment.completed(admins)', e));
  }

  // ---- 11.5.7 PaymentFailed → customer ---------------------------------------
  @OnEvent(DOMAIN_EVENTS.PAYMENT_FAILED)
  async handlePaymentFailed(payload: {
    paymentId?: string;
    userId?: string;
    requestId?: string | null;
    amount?: number;
    reason?: string;
  }) {
    if (!payload?.userId) return;
    await this.notifications
      .send(payload.userId, NotificationType.PAYMENT_FAILED, {
        paymentId: payload.paymentId,
        amount: payload.amount,
        reason: payload.reason,
      })
      .catch((e: unknown) => this.logFail('payment.failed', e));
  }

  // ---- 11.5.8 WalletCharged → customer ---------------------------------------
  @OnEvent(DOMAIN_EVENTS.WALLET_CHARGED)
  async handleWalletCharged(payload: {
    userId?: string;
    amount?: number;
    balance?: number;
    transactionType?: string;
  }) {
    if (!payload?.userId) return;
    await this.notifications
      .send(payload.userId, NotificationType.WALLET_CHARGED, {
        amount: payload.amount,
        balance: payload.balance,
        transactionType: payload.transactionType,
      })
      .catch((e: unknown) => this.logFail('wallet.charged', e));
  }

  // ---- 11.5.9 RefundIssued → customer ----------------------------------------
  @OnEvent(DOMAIN_EVENTS.WALLET_REFUNDED)
  async handleWalletRefunded(payload: {
    userId?: string;
    amount?: number;
    balance?: number;
    trackingCode?: string;
  }) {
    if (!payload?.userId) return;
    await this.notifications
      .send(payload.userId, NotificationType.REFUND_ISSUED, {
        amount: payload.amount,
        balance: payload.balance,
        trackingCode: payload.trackingCode,
      })
      .catch((e: unknown) => this.logFail('wallet.refunded', e));
  }

  private logFail(event: string, err: unknown): void {
    this.logger.error(
      `Listener ${event} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
