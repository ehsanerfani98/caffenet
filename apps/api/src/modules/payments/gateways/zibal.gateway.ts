import { Injectable } from '@nestjs/common';
import { Axios } from 'axios';
import {
  BaseGatewayAdapter,
  GatewayCreateResult,
  GatewayPaymentRequest,
  GatewayVerifyResult,
} from '../payment-gateway.interface';
import { SettingsService } from '../../../config/settings.service';

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
 * Config (Phase 12 pre-req — settings from DB): merchant id / sandbox read at
 * REQUEST time from Admin → Settings → درگاه پرداخت, ZIBAL_* env fallback.
 * ('zibal' merchant = sandbox mode.)
 */
@Injectable()
export class ZibalGateway extends BaseGatewayAdapter {
  readonly name = 'zibal';
  private readonly http = new Axios({ headers: { 'Content-Type': 'application/json' } });

  constructor(private readonly settings: SettingsService) {
    super();
  }

  private static baseUrlFor(sandbox: boolean): string {
    return sandbox ? 'https://sandbox.gateway.zibal.ir' : 'https://gateway.zibal.ir';
  }

  async createPayment(req: GatewayPaymentRequest): Promise<GatewayCreateResult> {
    const { merchantId, sandbox } = await this.settings.getZibalConfig();
    const baseUrl = ZibalGateway.baseUrlFor(sandbox);
    const payload = {
      merchant: sandbox ? 'zibal' : merchantId,
      amount: Number(req.amountMinor),
      callbackUrl: req.callbackUrl,
      orderId: req.orderId,
      description: req.description.slice(0, 255),
      ...(req.mobile ? { mobile: req.mobile } : {}),
    };

    const response = await this.http.post(`${baseUrl}/v1/request`, payload, {
      timeout: 20_000,
      transformResponse: [(d: string) => d],
    } as never);
    const body = JSON.parse((response as unknown as { data: string }).data ?? '{}');

    if (body?.trackId && (body?.result === 100 || sandbox)) {
      return {
        authority: String(body.trackId),
        redirectUrl: `${baseUrl}/${body.trackId}`,
        raw: body,
      };
    }
    throw new Error(`Zibal request failed (${body?.result}): ${body?.message ?? 'unknown'}`);
  }

  async verifyPayment(params: {
    authority: string;
    amountMinor: bigint;
  }): Promise<GatewayVerifyResult> {
    const { merchantId, sandbox } = await this.settings.getZibalConfig();
    const baseUrl = ZibalGateway.baseUrlFor(sandbox);
    const payload = {
      merchant: sandbox ? 'zibal' : merchantId,
      trackId: params.authority,
    };

    const response = await this.http.post(`${baseUrl}/v1/verify`, payload, {
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
