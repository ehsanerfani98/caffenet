import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { PaymentsService } from '../payments/payments.service';
import { CurrencyHelper, PaymentGatewayName } from '@caffenet/shared';

/**
 * RequestPaymentService (Phase 6.5) — unified entry point for paying a
 * request that is in waiting_for_payment.
 *
 *  - method = 'wallet'  → atomic debit + request marked paid (6.5.2)
 *  - method = 'online'  → gateway payment bound to the request; the wallet
 *    settles automatically once the callback verifies (6.5.3)
 *
 * Guards (6.5.4 / 6.5.5):
 *  - request must be owned by the caller
 *  - request must be in waiting_for_payment
 *  - double payment rejected (successful/verifying payment exists, or the
 *    wallet ledger already contains a service_payment for the request)
 */
@Injectable()
export class RequestPaymentService {
  private readonly logger = new Logger(RequestPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly payments: PaymentsService,
  ) {}

  async payRequest(params: {
    userId: string;
    requestId: string;
    method: 'wallet' | 'online';
    gateway?: 'zarinpal' | 'zibal';
  }) {
    const request = await this.prisma.request.findUnique({
      where: { id: BigInt(params.requestId) },
    });
    if (!request) throw new NotFoundException('درخواست یافت نشد');
    if (request.customerId !== BigInt(params.userId)) {
      throw new ForbiddenException('این درخواست متعلق به شما نیست');
    }
    // 6.5.5
    if (request.status !== 'waiting_for_payment') {
      throw new ConflictException({
        code: 'INVALID_REQUEST_STATUS',
        message: 'درخواست در وضعیت قابل پرداخت نیست',
      });
    }
    // 6.5.4 — already paid via wallet ledger?
    const paidLedger = await this.prisma.walletTransaction.findUnique({
      where: { idempotencyKey: `service_payment:request:${request.id}` },
    });
    if (paidLedger) {
      throw new ConflictException({
        code: 'ALREADY_PAID',
        message: 'این درخواست قبلاً پرداخت شده است',
      });
    }
    // 6.5.4 — in-flight / successful online payment?
    const inFlight = await this.prisma.payment.findFirst({
      where: {
        requestId: request.id,
        status: { in: ['successful', 'verifying'] },
      },
    });
    if (inFlight) {
      throw new ConflictException({
        code: 'PAYMENT_ALREADY_IN_PROGRESS',
        message: 'برای این درخواست پرداخت در جریان است یا انجام شده است',
      });
    }

    if (params.method === 'wallet') {
      // 6.5.2 — atomic debit + status transition inside one tx
      const result = await this.wallet.payForRequest(params.userId, params.requestId);
      return {
        method: 'wallet' as const,
        requestId: result.requestId,
        trackingCode: result.trackingCode,
        status: result.status,
        amount: CurrencyHelper.toMajor(Number(result.amountMinor)),
        walletBalance: CurrencyHelper.toMajor(Number(result.balanceAfterMinor)),
      };
    }

    // 6.5.3 — online: bind a gateway payment to this request
    const amountToman = CurrencyHelper.toMajor(Number(request.finalTotal));
    const created = await this.payments.createPayment({
      userId: params.userId,
      amountToman,
      gateway: params.gateway as PaymentGatewayName | undefined,
      requestId: params.requestId,
      description: `پرداخت درخواست ${request.trackingCode}`,
    });

    return {
      method: 'online' as const,
      requestId: params.requestId,
      trackingCode: request.trackingCode,
      status: 'pending' as const,
      amount: created.payment.amount,
      paymentId: created.payment.id,
      redirectUrl: created.redirectUrl,
      gateway: created.payment.gateway,
    };
  }
}
