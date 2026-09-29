import { Logger } from '@nestjs/common';

/**
 * PaymentGateway (Phase 6.4.5) — every Iranian PSP adapter implements this.
 *
 * IMPORTANT (6.4.8): verification ALWAYS happens server-side by calling the
 * gateway's verify API. Client-side callback data is treated as a hint only
 * and is never trusted for money movement.
 */

export interface GatewayPaymentRequest {
  /** Minor units (Rial) */
  amountMinor: bigint;
  /** Gateway-side unique id for our record — used as merchant order id */
  orderId: string;
  description: string;
  /** Absolute URL the gateway redirects back to after payment */
  callbackUrl: string;
  /** Customer mobile (optional, helps some gateways) */
  mobile?: string | null;
}

export interface GatewayCreateResult {
  /** Gateway authority / track id */
  authority: string;
  /** URL to redirect the customer to */
  redirectUrl: string;
  raw: unknown;
}

export interface GatewayVerifyResult {
  success: boolean;
  /** 'verified' (fresh), 'already_verified' (idempotent re-check), 'failed' */
  state: 'verified' | 'already_verified' | 'failed';
  /** Gateway reference number on success */
  referenceNumber?: string | null;
  /** Card PAN mask if provided by gateway */
  cardPan?: string | null;
  message?: string;
  raw: unknown;
}

export interface GatewayRefundResult {
  success: boolean;
  message?: string;
  raw: unknown;
}

export interface PaymentGateway {
  readonly name: string;
  createPayment(req: GatewayPaymentRequest): Promise<GatewayCreateResult>;
  verifyPayment(params: {
    authority: string;
    /** Minor units (Rial) — expected amount for verification */
    amountMinor: bigint;
  }): Promise<GatewayVerifyResult>;
  refund?(params: { authority: string; amountMinor: bigint }): Promise<GatewayRefundResult>;
}

/** Shared HTTP plumbing + error taxonomy for gateway adapters. */
export abstract class BaseGatewayAdapter implements PaymentGateway {
  abstract readonly name: string;
  protected readonly logger = new Logger('PaymentGateway');

  abstract createPayment(req: GatewayPaymentRequest): Promise<GatewayCreateResult>;
  abstract verifyPayment(params: {
    authority: string;
    amountMinor: bigint;
  }): Promise<GatewayVerifyResult>;

  async refund?(params: { authority: string; amountMinor: bigint }): Promise<GatewayRefundResult> {
    return { success: false, message: 'refund not supported by this gateway', raw: null };
  }
}
