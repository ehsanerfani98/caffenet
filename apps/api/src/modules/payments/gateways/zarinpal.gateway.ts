import { Injectable } from '@nestjs/common';
import { Axios } from 'axios';
import {
  BaseGatewayAdapter,
  GatewayCreateResult,
  GatewayVerifyResult,
  GatewayPaymentRequest,
} from '../payment-gateway.interface';
import { SettingsService } from '../../../config/settings.service';

/**
 * ZarinPal gateway adapter (Phase 6.4.3) — PG v4 REST API.
 *
 *  - Request:  POST {base}/pg/v4/payment/request.json  → data.authority
 *  - Redirect: {base}/pg/StartPay/{authority}
 *  - Verify:   POST {base}/pg/v4/payment/verify.json   → data.code 100 (ok) | 101 (already verified)
 *
 * Amount unit: v4 expects Rials — Caffenet minor units are Rials (IRT×100),
 * so we pass amounts through unchanged.
 *
 * Config (Phase 12 pre-req — settings from DB): merchant id / sandbox read at
 * REQUEST time from Admin → Settings → درگاه پرداخت, ZARINPAL_* env fallback.
 */
@Injectable()
export class ZarinpalGateway extends BaseGatewayAdapter {
  readonly name = 'zarinpal';
  private readonly http = new Axios({ headers: { 'Content-Type': 'application/json' } });

  constructor(private readonly settings: SettingsService) {
    super();
  }

  private async resolveConfig(): Promise<{ merchantId: string; sandbox: boolean }> {
    return this.settings.getZarinpalConfig();
  }

  private baseUrlFor(sandbox: boolean): string {
    return sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
  }

  async createPayment(req: GatewayPaymentRequest): Promise<GatewayCreateResult> {
    const { merchantId, sandbox } = await this.resolveConfig();
    const baseUrl = this.baseUrlFor(sandbox);
    const payload = {
      merchant_id: merchantId,
      amount: Number(req.amountMinor),
      description: req.description.slice(0, 255),
      callback_url: req.callbackUrl,
      metadata: {
        order_id: req.orderId,
        ...(req.mobile ? { mobile: req.mobile } : {}),
      },
    };

    const response = await this.http.post(`${baseUrl}/pg/v4/payment/request.json`, payload, {
      timeout: 20_000,
      // Axios instance is not typed; treat body generically
      transformResponse: [(d: string) => d],
    } as never);
    const body = JSON.parse((response as unknown as { data: string }).data ?? '{}');

    if (body?.data?.authority) {
      return {
        authority: body.data.authority,
        redirectUrl: `${baseUrl}/pg/StartPay/${body.data.authority}`,
        raw: body,
      };
    }
    const code = body?.errors?.code ?? 'UNKNOWN';
    const message = body?.errors?.message ?? 'خطا در ایجاد پرداخت زرین‌پال';
    throw new Error(`ZarinPal request failed (${code}): ${message}`);
  }

  async verifyPayment(params: {
    authority: string;
    amountMinor: bigint;
  }): Promise<GatewayVerifyResult> {
    const { merchantId, sandbox } = await this.resolveConfig();
    const baseUrl = this.baseUrlFor(sandbox);
    const payload = {
      merchant_id: merchantId,
      amount: Number(params.amountMinor),
      authority: params.authority,
    };

    const response = await this.http.post(`${baseUrl}/pg/v4/payment/verify.json`, payload, {
      timeout: 20_000,
      transformResponse: [(d: string) => d],
    } as never);
    const body = JSON.parse((response as unknown as { data: string }).data ?? '{}');
    const code = body?.data?.code;

    // 100 = verified now, 101 = verified before (idempotent re-check) — 6.4.9
    if (code === 100 || code === 101) {
      return {
        success: true,
        state: code === 100 ? 'verified' : 'already_verified',
        referenceNumber: String(body.data.ref_id ?? ''),
        cardPan: body.data.card_pan ?? null,
        message: code === 100 ? 'پرداخت تأیید شد' : 'پرداخت قبلاً تأیید شده است',
        raw: body,
      };
    }
    return {
      success: false,
      state: 'failed',
      message: body?.errors?.message ?? 'تأیید پرداخت ناموفق بود',
      raw: body,
    };
  }
}
