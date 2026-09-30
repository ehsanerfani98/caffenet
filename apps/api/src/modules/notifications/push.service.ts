/**
 * PushService (Phase 11.4) — Web Push delivery via the `web-push` library.
 *
 * Responsibilities:
 *  - Configure VAPID keys once at boot (no-op + disabled state when absent,
 *    mirroring PusherService behaviour for dev environments).
 *  - Deliver a push payload to a single subscription.
 *  - Map delivery failures to lifecycle outcomes:
 *      404 / 410 Gone  → subscription is dead, caller must delete it
 *                        (11.4.6 subscription expiry detection)
 *      other           → transient failure, caller may retry via queue
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  tag?: string;
}

export type PushDeliveryOutcome = 'sent' | 'gone' | 'failed' | 'disabled';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey = '';
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY') ?? '';
    const subject =
      this.config.get<string>('VAPID_SUBJECT') ||
      this.config.get<string>('APP_URL') ||
      'mailto:support@caffenet.local';

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys missing — Web Push disabled (generate with: npx web-push generate-vapid-keys)',
      );
      return;
    }

    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } catch (err) {
      // Invalid keys must never crash the whole API — disable push instead
      this.logger.error(
        `VAPID keys invalid — Web Push disabled: ${err instanceof Error ? err.message : err}`,
      );
      return;
    }

    this.publicKey = publicKey;
    this.configured = true;
    this.logger.log('Web Push configured (VAPID ready)');
  }

  /** Whether push delivery is possible in this environment. */
  get isEnabled(): boolean {
    return this.configured;
  }

  /** VAPID public key exposed to browsers for pushManager.subscribe(). */
  get vapidPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Send a push to one subscription. Never throws — returns an outcome so
   * queue handlers can decide between complete() and fail().
   */
  async sendToSubscription(
    sub: PushSubscriptionKeys,
    payload: PushPayload,
  ): Promise<PushDeliveryOutcome> {
    if (!this.configured) return 'disabled';

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dhKey, auth: sub.authKey } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 }, // 24h — unread pushes expire
      );
      return 'sent';
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Subscription expired or revoked → permanent
        return 'gone';
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Push delivery failed (status=${statusCode ?? 'n/a'}): ${message}`);
      return 'failed';
    }
  }
}
