/**
 * PushService (Phase 11.4 / Phase 12 pre-req) — Web Push delivery via the
 * `web-push` library.
 *
 * Responsibilities:
 *  - VAPID credentials resolve from DATABASE settings (Admin → Settings → Push)
 *    with env fallback; the library is re-configured automatically whenever an
 *    admin changes the keys (fingerprint comparison, no restart needed).
 *  - `push.enabled` system-level master switch (on top of per-user prefs).
 *  - Deliver a push payload to a single subscription.
 *  - Map delivery failures to lifecycle outcomes:
 *      404 / 410 Gone  → subscription is dead, caller must delete it
 *                        (11.4.6 subscription expiry detection)
 *      other           → transient failure, caller may retry via queue
 */

import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { SettingsService } from '../../config/settings.service';

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
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private publicKey = '';
  private fingerprint = '';
  private configured = false;
  private systemEnabled = true;

  constructor(private readonly settings: SettingsService) {}

  /**
   * Ensure web-push is configured for the CURRENT DB settings. Cheap after
   * the first call (fingerprint short-circuit).
   */
  private async ensureConfigured(): Promise<boolean> {
    const cfg = await this.settings.getVapidConfig();
    const fingerprint = `${cfg.publicKey}|${cfg.privateKey}|${cfg.subject}`;

    if (this.fingerprint !== fingerprint) {
      this.fingerprint = fingerprint;
      this.configured = false;
      if (!cfg.publicKey || !cfg.privateKey) {
        this.logger.warn(
          'VAPID keys missing — Web Push disabled. Configure in Admin → Settings → Push (or generate with: npx web-push generate-vapid-keys)',
        );
      } else {
        try {
          webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
          this.publicKey = cfg.publicKey;
          this.configured = true;
          this.logger.log('Web Push configured (VAPID ready — DB settings)');
        } catch (err) {
          // Invalid keys must never crash the whole API — disable push instead
          this.logger.error(
            `VAPID keys invalid — Web Push disabled: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }
    return this.configured;
  }

  /** Whether push delivery is possible in this environment AND system-enabled. */
  get isEnabled(): boolean {
    return this.configured && this.systemEnabled;
  }

  /** VAPID public key exposed to browsers for pushManager.subscribe(). */
  get vapidPublicKey(): string {
    return this.publicKey;
  }

  /** Async variant used by HTTP endpoints — resolves DB settings first. */
  async getStatus(): Promise<{ enabled: boolean; publicKey: string | null }> {
    const ok = await this.ensureConfigured();
    this.systemEnabled = (await this.settings.getBoolean('push.enabled', true)) ?? true;
    return { enabled: ok && this.systemEnabled, publicKey: ok ? this.publicKey : null };
  }

  /**
   * Send a push to one subscription. Never throws — returns an outcome so
   * queue handlers can decide between complete() and fail().
   */
  async sendToSubscription(
    sub: PushSubscriptionKeys,
    payload: PushPayload,
  ): Promise<PushDeliveryOutcome> {
    const ok = await this.ensureConfigured();
    if (!ok) return 'disabled';

    // System-level master switch (per-user preference is checked upstream)
    this.systemEnabled = (await this.settings.getBoolean('push.enabled', true)) ?? true;
    if (!this.systemEnabled) return 'disabled';

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
