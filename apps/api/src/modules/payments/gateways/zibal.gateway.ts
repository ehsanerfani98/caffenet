import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Axios } from 'axios';
import {
  BaseGatewayAdapter,
  GatewayCreateResult,
  GatewayPaymentRequest,
  GatewayVerifyResult,
} from '../payment-gateway.interface';

/**
 * Zibal gateway adapter (Phase 6.4.4) — v1 REST API.
 *
 *  - Request:  POST https://gateway.zibal.ir/v1/request  → trackId (result 100)
 *  - Redirect: https://gateway.zibal.ir/{trackId}
 *  - Callback: GET ?trackId=…&success=1|0&status=… (client hint only — never trusted)
 *  - Verify:   POST https://gateway.zibal.ir/v1/verify    → result 100 (ok)
 *
 * Amount unit: Rials — same as Caffenet minor units.
 *
 * Config: ZIBAL_MERCHANT_ID ('zibal' = sandbox), ZIBAL_SANDBOX (default true).
 */
@Injectable()
export class ZibalGateway extends BaseGatewayAdapter {
  readonly name = 'zibal';
  private readonly http = new Axios({ headers: { 'Content-Type': 'application/json' } });
  private readonly merchantId: string;
  private readonly sandbox: boolean;

  constructor(config: ConfigService) {
    super();
    this.merchantId = config.get<string>('ZIBAL_MERCHANT_ID', 'zibal')!;
    this.sandbox = config.get<boolean>('ZIBAL_SANDBOX', true);
  }

  private get baseUrl(): string {
    return this.sandbox ? 'https://sandbox.gateway.zibal.ir' : 'https://gateway.zibal.ir';
  }

  async createPayment(req: GatewayPaymentRequest): Promise<GatewayCreateResult> {
    const payload = {
      merchant: this.sandbox ? 'zibal' : this.merchantId,
      amount: Number(req.amountMinor),
      callbackUrl: req.callbackUrl,
      orderId: req.orderId,
      description: req.description.slice(0, 255),
      ...(req.mobile ? { mobile: req.mobile } : {}),
    };

    const response = await this.http.post(`${this.baseUrl}/v1/request`, payload, {
      timeout: 20_000,
      transformResponse: [(d: string) => d],
    } as never);
    const body = JSON.parse((response as unknown as { data: string }).data ?? '{}');

    if (body?.trackId && (body?.result === 100 || this.sandbox)) {
      return {
        authority: String(body.trackId),
        redirectUrl: `${this.sandbox ? 'https://sandbox.gateway.zibal.ir' : 'https://gateway.zibal.ir'}/${body.trackId}`,
        raw: body,
      };
    }
    throw new Error(`Zibal request failed (${body?.result}): ${body?.message ?? 'unknown'}`);
  }

  async verifyPayment(params: {
    authority: string;
    amountMinor: bigint;
  }): Promise<GatewayVerifyResult> {
    const payload = {
      merchant: this.sandbox ? 'zibal' : this.merchantId,
      trackId: params.authority,
    };

    const response = await this.http.post(`${this.baseUrl}/v1/verify`, payload, {
      timeout: 20_000,
      transformResponse: [(d: string) => d],
    } as never);
    const body = JSON.parse((response as unknown as { data: string }).data ?? '{}');

    // result 100 = paid & verified; result 201 = already verified (idempotent re-check)
    if (body?.result === 100 || body?.result === 201) {
      return {
        success: true,
        state: body.result === 100 ? 'verified' : 'already_verified',
        referenceNumber: String(body.refNumber ?? body.trackId ?? ''),
        cardPan: body.cardNumber ?? null,
        message: body.result === 100 ? 'پرداخت تأیید شد' : 'پرداخت قبلاً تأیید شده است',
        raw: body,
      };
    }
    return {
      success: false,
      state: 'failed',
      message: body?.message ?? 'تأیید پرداخت ناموفق بود',
      raw: body,
    };
  }
}
