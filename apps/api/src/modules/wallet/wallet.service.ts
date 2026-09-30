import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { Prisma } from '@prisma/client';
import {
  DOMAIN_EVENTS,
  PUSHER_CONFIG,
  WALLET_CONFIG,
  WalletStatus,
  WalletTransactionStatus,
  WalletTransactionType,
  CurrencyHelper,
} from '@caffenet/shared';

/**
 * WalletService (Phase 6.1–6.3) — atomic wallet operations on top of an
 * immutable ledger.
 *
 * Core invariants:
 *  - Every mutation happens inside a Serializable transaction that first
 *    locks the wallet row with SELECT … FOR UPDATE (6.3.1/6.3.2).
 *  - Every mutation writes exactly one `wallet_transactions` ledger row in
 *    the same transaction (6.2.2) — the ledger is append-only.
 *  - Every ledger row carries a UNIQUE `idempotency_key`; a duplicate key
 *    aborts the operation, making double-spend impossible (6.3.5).
 *  - balance_before / balance_after are derived from the locked row, never
 *    from client input.
 *
 * Amounts are BigInt minor units (Rial) internally and converted to Toman
 * (major units) only at the API boundary.
 */

interface LockedWalletRow {
  id: bigint;
  balance: bigint;
  status: string;
}

interface LockedRequestRow {
  id: bigint;
  tracking_code: string;
  status: string;
  customer_id: bigint;
  final_total: bigint;
}

const WALLET_REF_TYPE = 'wallet';
const REQUEST_REF_TYPE = 'request';
const ADJUSTMENT_REF_TYPE = 'admin_adjustment';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly realtime: RealtimeService,
  ) {}

  // ==========================================================================
  // 6.1 — Read model
  // ==========================================================================

  /** 6.1.2 — auto-create on first access; safe under concurrency. */
  async getOrCreateWallet(userId: string) {
    const existing = await this.prisma.wallet.findUnique({
      where: { userId: BigInt(userId) },
    });
    if (existing) return existing;

    try {
      return await this.prisma.wallet.create({
        data: { userId: BigInt(userId), balance: 0n, status: WalletStatus.ACTIVE },
      });
    } catch {
      // Lost a creation race — the winner's row satisfies us
      return this.prisma.wallet.findUniqueOrThrow({ where: { userId: BigInt(userId) } });
    }
  }

  async getWalletForUser(userId: string, requestingUserId: string, isAdmin: boolean) {
    if (!isAdmin && userId !== requestingUserId) {
      throw new ForbiddenException('فقط کیف پول خودتان قابل مشاهده است');
    }
    const wallet = await this.getOrCreateWallet(userId);
    return this.toWalletDto(wallet);
  }

  /** 6.1.4 / 6.2 — paginated ledger, newest first. */
  async listTransactions(
    userId: string,
    requestingUserId: string,
    isAdmin: boolean,
    page = 1,
    limit = 20,
    type?: WalletTransactionType,
  ) {
    if (!isAdmin && userId !== requestingUserId) {
      throw new ForbiddenException('فقط تراکنش‌های خودتان قابل مشاهده است');
    }
    const wallet = await this.getOrCreateWallet(userId);
    const where = {
      walletId: wallet.id,
      ...(type ? { type } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toTransactionDto(r)),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ==========================================================================
  // 6.3 — Atomic mutations
  // ==========================================================================

  /**
   * 6.3.1 — credit the wallet.
   * `idempotencyKey` must be unique per logical operation (e.g. the payment id).
   */
  async deposit(params: {
    userId: string;
    amountMinor: bigint;
    referenceType?: string;
    referenceId?: string;
    description?: string;
    idempotencyKey: string;
  }) {
    this.assertAmount(params.amountMinor, true);
    return this.mutate(params.userId, params.amountMinor, WalletTransactionType.DEPOSIT, params);
  }

  /** 6.3.2 — debit; rejects insufficient balance. */
  async withdraw(params: {
    userId: string;
    amountMinor: bigint;
    referenceType?: string;
    referenceId?: string;
    description?: string;
    idempotencyKey: string;
  }) {
    this.assertAmount(params.amountMinor, false);
    return this.mutate(
      params.userId,
      -params.amountMinor,
      WalletTransactionType.WITHDRAWAL,
      params,
    );
  }

  /** 6.3 — admin manual adjustment (+credit / −debit). */
  async manualAdjustment(params: {
    userId: string;
    /** Toman (major units) — may be negative */
    amountToman: number;
    adminUserId: string;
    reason: string;
  }) {
    // toMinor() rejects negatives by design — split magnitude and sign
    const magnitude = CurrencyHelper.toMinor(Math.abs(params.amountToman));
    const amountMinor = BigInt(Math.sign(params.amountToman) * magnitude);
    if (amountMinor === 0n) {
      throw new BadRequestException('مبلغ تعدیل نمی‌تواند صفر باشد');
    }
    const tx = await this.mutate(
      params.userId,
      amountMinor,
      WalletTransactionType.MANUAL_ADJUSTMENT,
      {
        referenceType: ADJUSTMENT_REF_TYPE,
        referenceId: params.adminUserId,
        description: params.reason,
        idempotencyKey: `adjust:${params.userId}:${params.adminUserId}:${Date.now()}:${Math.floor(Math.random() * 1e9)}`,
      },
    );
    this.logger.log(
      `Wallet adjustment by admin ${params.adminUserId}: user ${params.userId} ${params.amountToman} Toman`,
    );
    return tx;
  }

  /**
   * 6.3.3 — pay a request from wallet balance.
   *
   * Atomic Serializable transaction:
   *  1) lock the request row (must belong to user + be waiting_for_payment)
   *  2) lock the wallet row, check balance ≥ final total
   *  3) insert SERVICE_PAYMENT ledger row (idempotency key = request-scoped)
   *  4) update wallet balance
   *  5) transition request → paid + status history
   *  6) mark invoice paid
   *
   * Double payment is impossible twice over: the request status check under
   * row lock AND the unique idempotency key derived from the request id.
   */
  async payForRequest(userId: string, requestId: string) {
    const rid = BigInt(requestId);
    const uid = BigInt(userId);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const request = await tx.$queryRaw<LockedRequestRow[]>(
          Prisma.sql`SELECT id, tracking_code, status, customer_id, final_total FROM requests WHERE id = ${rid} FOR UPDATE`,
        );
        const locked = request[0];
        if (!locked) {
          throw new NotFoundException('درخواست یافت نشد');
        }
        if (locked.customer_id !== uid) {
          throw new ForbiddenException('این درخواست متعلق به شما نیست');
        }
        if (locked.status !== 'waiting_for_payment') {
          throw new ConflictException({
            code: 'INVALID_REQUEST_STATUS',
            message: 'درخواست در وضعیت قابل پرداخت نیست',
          });
        }

        const wallet = await this.lockWallet(tx, uid);
        if (wallet.status !== WalletStatus.ACTIVE) {
          throw new ConflictException('کیف پول شما فعال نیست');
        }
        if (wallet.balance < locked.final_total) {
          throw new ConflictException({
            code: 'INSUFFICIENT_BALANCE',
            message: 'موجودی کیف پول کافی نیست',
          });
        }

        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore - locked.final_total;

        // Ledger entry — UNIQUE(request-scoped idempotency key) proves single payment
        const ledger = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: uid,
            type: WalletTransactionType.SERVICE_PAYMENT,
            amount: -locked.final_total,
            balanceBefore,
            balanceAfter,
            referenceType: REQUEST_REF_TYPE,
            referenceId: rid,
            description: `پرداخت درخواست ${locked.tracking_code}`,
            status: WalletTransactionStatus.COMPLETED,
            idempotencyKey: `service_payment:request:${rid}`,
          },
        });

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: balanceAfter },
        });

        await tx.request.update({
          where: { id: rid },
          data: { status: 'paid' },
        });

        await tx.requestStatusHistory.create({
          data: {
            requestId: rid,
            previousStatus: 'waiting_for_payment',
            newStatus: 'paid',
            userId: uid,
            note: 'پرداخت از کیف پول',
          },
        });

        await tx.invoice.updateMany({
          where: { requestId: rid, status: { not: 'paid' } },
          data: { status: 'paid', paidAt: new Date() },
        });

        return {
          ledger,
          trackingCode: locked.tracking_code,
          finalTotal: locked.final_total,
          balanceAfter,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      `Request ${result.trackingCode} paid from wallet (${result.finalTotal} minor) — user ${userId}`,
    );

    // Post-commit side effects (6.3.7)
    await this.emitWalletUpdated(userId, result.balanceAfter);
    await this.events.emit(DOMAIN_EVENTS.REQUEST_STATUS_CHANGED, {
      requestId,
      trackingCode: result.trackingCode,
      previousStatus: 'waiting_for_payment',
      newStatus: 'paid',
      by: userId,
      at: new Date().toISOString(),
    });
    await this.realtime
      .notifyRequestStatusChanged(requestId, {
        status: 'paid',
        trackingCode: result.trackingCode,
      })
      .catch(() => undefined);

    return {
      requestId: requestId,
      trackingCode: result.trackingCode,
      status: 'paid' as const,
      amountMinor: result.finalTotal,
      balanceAfterMinor: result.balanceAfter,
      ledgerId: result.ledger.id.toString(),
    };
  }

  /**
   * 6.3.4 — refund a paid request (operator/admin action).
   * Credits the customer's wallet and reverses the request status.
   * Idempotent per request via a scoped ledger key.
   */
  async refundRequest(requestId: string, actorUserId: string, reason?: string) {
    const rid = BigInt(requestId);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const request = await tx.$queryRaw<LockedRequestRow[]>(
          Prisma.sql`SELECT id, tracking_code, status, customer_id, final_total FROM requests WHERE id = ${rid} FOR UPDATE`,
        );
        const locked = request[0];
        if (!locked) {
          throw new NotFoundException('درخواست یافت نشد');
        }
        if (locked.status !== 'paid') {
          throw new ConflictException({
            code: 'INVALID_REQUEST_STATUS',
            message: 'فقط درخواست پرداخت‌شده قابل بازگشت وجه است',
          });
        }

        const wallet = await this.lockWallet(tx, locked.customer_id);
        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + locked.final_total;

        const ledger = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: locked.customer_id,
            type: WalletTransactionType.REFUND,
            amount: locked.final_total,
            balanceBefore,
            balanceAfter,
            referenceType: REQUEST_REF_TYPE,
            referenceId: rid,
            description: `بازگشت وجه درخواست ${locked.tracking_code}${reason ? ` — ${reason}` : ''}`,
            status: WalletTransactionStatus.COMPLETED,
            idempotencyKey: `refund:request:${rid}`,
          },
        });

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: balanceAfter },
        });

        await tx.request.update({
          where: { id: rid },
          data: { status: 'cancelled' },
        });

        await tx.requestStatusHistory.create({
          data: {
            requestId: rid,
            previousStatus: 'paid',
            newStatus: 'cancelled',
            userId: BigInt(actorUserId),
            note: reason ? `بازگشت وجه — ${reason}` : 'بازگشت وجه',
          },
        });

        return {
          customerId: locked.customer_id.toString(),
          trackingCode: locked.tracking_code,
          refundedMinor: locked.final_total,
          balanceAfter,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      `Refund for request ${result.trackingCode}: ${result.refundedMinor} minor credited (actor ${actorUserId})`,
    );

    await this.emitWalletUpdated(result.customerId, result.balanceAfter);
    // Phase 11.5.9 — refund notification event (refunds bypass mutate())
    await this.events
      .emit(DOMAIN_EVENTS.WALLET_REFUNDED, {
        userId: result.customerId,
        amount: CurrencyHelper.toMajor(Number(result.refundedMinor)),
        balance: CurrencyHelper.toMajor(Number(result.balanceAfter)),
        trackingCode: result.trackingCode,
        at: new Date().toISOString(),
      })
      .catch(() => undefined);
    return {
      requestId: requestId,
      trackingCode: result.trackingCode,
      refundedMinor: result.refundedMinor,
    };
  }

  /**
   * 6.4.11 — credit a verified online payment into the wallet and
   * (optionally) settle the attached request, all atomically.
   * Called only from PaymentsService.verify — never exposed directly.
   */
  async settlePayment(params: {
    userId: string;
    paymentId: string;
    amountMinor: bigint;
    requestId?: string | null;
  }) {
    const uid = BigInt(params.userId);
    const pid = BigInt(params.paymentId);
    const rid = params.requestId ? BigInt(params.requestId) : null;

    const balanceAfter = await this.prisma.$transaction(
      async (tx) => {
        const wallet = await this.lockWallet(tx, uid);

        try {
          // Deposit ledger row — UNIQUE idempotency key makes re-callbacks safe
          const balanceAfterNew = wallet.balance + params.amountMinor;
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              userId: uid,
              type: WalletTransactionType.DEPOSIT,
              amount: params.amountMinor,
              balanceBefore: wallet.balance,
              balanceAfter: balanceAfterNew,
              referenceType: 'payment',
              referenceId: pid,
              description: `شارژ کیف پول — پرداخت شماره ${pid}`,
              status: WalletTransactionStatus.COMPLETED,
              idempotencyKey: `payment_deposit:${pid}`,
            },
          });
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: balanceAfterNew },
          });
          return balanceAfterNew;
        } catch (e) {
          // Duplicate deposit → payment already settled; return current balance
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            const existing = await tx.walletTransaction.findUniqueOrThrow({
              where: { idempotencyKey: `payment_deposit:${pid}` },
            });
            return existing.balanceAfter;
          }
          throw e;
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // If the payment was created for a request, settle it now (wallet is funded)
    if (rid) {
      const request = await this.prisma.request.findUnique({
        where: { id: rid },
        select: { status: true },
      });
      if (request?.status === 'waiting_for_payment') {
        await this.payForRequest(params.userId, rid.toString());
      }
    }

    await this.emitWalletUpdated(params.userId, balanceAfter);
    return balanceAfter;
  }

  // ==========================================================================
  // Internals
  // ==========================================================================

  /** Lock and return the wallet row inside an open transaction. */
  private async lockWallet(tx: Prisma.TransactionClient, userId: bigint): Promise<LockedWalletRow> {
    const created = await tx.$queryRaw<LockedWalletRow[]>(
      Prisma.sql`SELECT id, balance, status FROM wallets WHERE user_id = ${userId} FOR UPDATE`,
    );
    let wallet = created[0];
    if (!wallet) {
      // Auto-create under lock (6.1.2)
      const newRow = await tx.wallet.create({
        data: { userId, balance: 0n, status: WalletStatus.ACTIVE },
      });
      wallet = { id: newRow.id, balance: newRow.balance, status: newRow.status };
    }
    return wallet;
  }

  /** Shared mutation core: Serializable tx + row lock + ledger + balance. */
  private async mutate(
    userId: string,
    signedAmountMinor: bigint,
    type: WalletTransactionType,
    params: {
      referenceType?: string;
      referenceId?: string;
      description?: string;
      idempotencyKey: string;
    },
  ) {
    const uid = BigInt(userId);

    const ledger = await this.prisma.$transaction(
      async (tx) => {
        const wallet = await this.lockWallet(tx, uid);
        if (wallet.status !== WalletStatus.ACTIVE) {
          throw new ConflictException('کیف پول شما فعال نیست');
        }
        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + signedAmountMinor;
        if (balanceAfter < 0n) {
          throw new ConflictException({
            code: 'INSUFFICIENT_BALANCE',
            message: 'موجودی کیف پول کافی نیست',
          });
        }

        const row = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: uid,
            type,
            amount: signedAmountMinor,
            balanceBefore,
            balanceAfter,
            referenceType: params.referenceType ?? WALLET_REF_TYPE,
            referenceId: params.referenceId ? BigInt(params.referenceId) : null,
            description: params.description,
            status: WalletTransactionStatus.COMPLETED,
            idempotencyKey: params.idempotencyKey,
          },
        });

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: balanceAfter },
        });

        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.emitWalletUpdated(userId, ledger.balanceAfter);

    // Phase 11.5.8/11.5.9 — typed credit events for the notification pipeline.
    // Payment settlements (settlePayment) notify via payment.completed instead.
    // REFUND rows carry a positive amount — check the type FIRST.
    if (ledger.type === WalletTransactionType.REFUND) {
      await this.events
        .emit(DOMAIN_EVENTS.WALLET_REFUNDED, {
          userId,
          amount: CurrencyHelper.toMajor(Number(ledger.amount)),
          balance: CurrencyHelper.toMajor(Number(ledger.balanceAfter)),
          referenceType: ledger.referenceType,
          referenceId: ledger.referenceId ? ledger.referenceId.toString() : null,
          at: new Date().toISOString(),
        })
        .catch(() => undefined);
    } else if (ledger.amount > 0n) {
      // any other credit (deposit / bonus / discount / positive adjustment)
      await this.events
        .emit(DOMAIN_EVENTS.WALLET_CHARGED, {
          userId,
          amount: CurrencyHelper.toMajor(Number(ledger.amount)),
          balance: CurrencyHelper.toMajor(Number(ledger.balanceAfter)),
          transactionType: ledger.type,
          at: new Date().toISOString(),
        })
        .catch(() => undefined);
    }

    return ledger;
  }

  private assertAmount(amountMinor: bigint, isDeposit: boolean) {
    const min = BigInt(
      isDeposit ? WALLET_CONFIG.MIN_DEPOSIT_AMOUNT : WALLET_CONFIG.MIN_WITHDRAWAL_AMOUNT,
    );
    const max = BigInt(
      isDeposit ? WALLET_CONFIG.MAX_DEPOSIT_AMOUNT : WALLET_CONFIG.MAX_WITHDRAWAL_AMOUNT,
    );
    if (amountMinor < min || amountMinor > max) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: `مبلغ باید بین ${CurrencyHelper.toMajor(Number(min))} و ${CurrencyHelper.toMajor(Number(max))} تومان باشد`,
      });
    }
  }

  private async emitWalletUpdated(userId: string, balanceAfterMinor: bigint) {
    const payload = {
      userId,
      balance: CurrencyHelper.toMajor(Number(balanceAfterMinor)),
      at: new Date().toISOString(),
    };
    await this.events.emit(DOMAIN_EVENTS.WALLET_UPDATED, payload);
    await this.realtime.notifyUser(userId, 'WalletUpdated', payload).catch(() => undefined);
  }

  toWalletDto(w: {
    id: bigint;
    uuid: string;
    userId: bigint;
    balance: bigint;
    currency: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: w.id.toString(),
      uuid: w.uuid,
      userId: w.userId.toString(),
      balance: CurrencyHelper.toMajor(Number(w.balance)),
      currency: w.currency,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    };
  }

  toTransactionDto(r: {
    id: bigint;
    uuid: string;
    walletId: bigint;
    userId: bigint;
    type: string;
    amount: bigint;
    balanceBefore: bigint;
    balanceAfter: bigint;
    referenceType: string | null;
    referenceId: bigint | null;
    description: string | null;
    status: string;
    createdAt: Date;
  }) {
    return {
      id: r.id.toString(),
      uuid: r.uuid,
      walletId: r.walletId.toString(),
      userId: r.userId.toString(),
      type: r.type,
      amount: CurrencyHelper.toMajor(Number(r.amount)),
      balanceBefore: CurrencyHelper.toMajor(Number(r.balanceBefore)),
      balanceAfter: CurrencyHelper.toMajor(Number(r.balanceAfter)),
      referenceType: r.referenceType,
      referenceId: r.referenceId?.toString() ?? null,
      description: r.description,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
