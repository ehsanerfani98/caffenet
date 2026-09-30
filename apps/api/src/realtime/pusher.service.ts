import { Injectable, Logger } from '@nestjs/common';
import Pusher from 'pusher';
import { SettingsService } from '../config/settings.service';

/**
 * Pusher.com cloud client.
 * Real-time events are published to Pusher from the backend; clients
 * subscribe via pusher-js (browser). Channel authorization is handled
 * by the BroadcastingController using signed JWT.
 *
 * Channel naming:
 *  - private-request.{requestId}   (customer + assigned operator + admin)
 *  - presence-request.{requestId}  (same + presence info)
 *  - private-user.{userId}          (user-specific notifications)
 *  - private-admin                  (all admins)
 *
 * Credentials resolution (Phase 12 pre-req — settings from DB):
 *  - read from `system_settings` (admin site-settings UI) via SettingsService
 *  - env (PUSHER_*) remains a fallback for zero-config boots
 *  - the client is (re)initialized lazily; when an admin changes credentials
 *    the fingerprint changes and a fresh client is built on the next call —
 *    no restart required.
 */
@Injectable()
export class PusherService {
  private readonly logger = new Logger(PusherService.name);
  private client: Pusher | null = null;
  private fingerprint = '';
  private credentials: {
    appId: string;
    key: string;
    secret: string;
    cluster: string;
    enabled: boolean;
  } | null = null;

  constructor(private readonly settings: SettingsService) {}

  /**
   * Ensure a client exists for the CURRENT DB settings. Safe to call on every
   * trigger/auth — returns instantly when the fingerprint is unchanged.
   */
  async ensureClient(): Promise<Pusher | null> {
    const cfg = await this.settings.getPusherConfig();
    const fingerprint = `${cfg.appId}|${cfg.key}|${cfg.secret}|${cfg.cluster}|${cfg.enabled}`;

    if (this.client && this.fingerprint === fingerprint) return this.client;

    this.credentials = cfg;
    this.fingerprint = fingerprint;
    this.client = null;

    if (!cfg.enabled || !cfg.appId || !cfg.key || !cfg.secret) {
      this.logger.warn(
        '⚠️ Pusher disabled or credentials missing — real-time events are no-op. Configure in Admin → Settings → Pusher (or env).',
      );
      return null;
    }

    try {
      this.client = new Pusher({
        appId: cfg.appId,
        key: cfg.key,
        secret: cfg.secret,
        cluster: cfg.cluster,
        useTLS: true,
      });
      this.logger.log(`✅ Pusher client initialized (cluster: ${cfg.cluster})`);
    } catch (err) {
      this.logger.error(`Pusher client init failed: ${err instanceof Error ? err.message : err}`);
      this.client = null;
    }
    return this.client;
  }

  /** Public key / secret for the Pusher webhook HMAC check (null when unset). */
  async getCredentials(): Promise<{ key: string; secret: string } | null> {
    await this.ensureClient();
    if (!this.credentials || !this.credentials.key || !this.credentials.secret) return null;
    return { key: this.credentials.key, secret: this.credentials.secret };
  }

  /** Whether the broadcasting auth endpoint can sign subscriptions right now. */
  async isReady(): Promise<boolean> {
    return (await this.ensureClient()) !== null;
  }

  /**
   * Publish an event to a private/presence channel.
   * Safe to call even if Pusher is disabled (no-op).
   */
  async trigger(channel: string, event: string, data: unknown): Promise<void> {
    const client = await this.ensureClient();
    if (!client) {
      this.logger.debug(`Pusher disabled — skipping event ${event} on ${channel}`);
      return;
    }
    try {
      await client.trigger(channel, event, data);
    } catch (err) {
      this.logger.error(`Failed to publish ${event} on ${channel}: ${(err as Error).message}`);
      // Don't throw — we don't want to fail the calling transaction
    }
  }

  /**
   * Authenticate a private/presence channel subscription request from a client.
   * Call ensureClient() first (BroadcastingController.authorize awaits isReady).
   */
  authenticate(
    socketId: string,
    channel: string,
    userData?: { user_id: string; user_info?: unknown },
  ): string {
    if (!this.client) {
      throw new Error('Pusher not configured');
    }
    if (channel.startsWith('presence-')) {
      if (!userData) {
        throw new Error('Presence channels require user data');
      }
      const auth = this.client.authorizeChannel(
        socketId,
        channel,
        userData as unknown as Parameters<typeof this.client.authorizeChannel>[2],
      );
      return typeof auth === 'string' ? auth : JSON.stringify(auth);
    }
    return this.client.authorizeChannel(socketId, channel) as unknown as string;
  }
}
