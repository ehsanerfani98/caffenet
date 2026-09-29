import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';

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
 */
@Injectable()
export class PusherService implements OnModuleInit {
  private readonly logger = new Logger(PusherService.name);
  private client: Pusher | null = null;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const appId = this.config.get<string>('PUSHER_APP_ID');
    const key = this.config.get<string>('PUSHER_KEY');
    const secret = this.config.get<string>('PUSHER_SECRET');
    const cluster = this.config.get<string>('PUSHER_CLUSTER', 'mt1');

    if (!appId || !key || !secret) {
      this.logger.warn(
        '⚠️ Pusher credentials missing — real-time events will be no-op. Set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET in env.',
      );
      this.enabled = false;
      return;
    }

    this.client = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
    this.enabled = true;
    this.logger.log(`✅ Pusher client initialized (cluster: ${cluster})`);
  }

  /**
   * Publish an event to a private/presence channel.
   * Safe to call even if Pusher is disabled (no-op).
   */
  async trigger(channel: string, event: string, data: unknown): Promise<void> {
    if (!this.enabled || !this.client) {
      this.logger.debug(`Pusher disabled — skipping event ${event} on ${channel}`);
      return;
    }
    try {
      await this.client.trigger(channel, event, data);
    } catch (err) {
      this.logger.error(`Failed to publish ${event} on ${channel}: ${(err as Error).message}`);
      // Don't throw — we don't want to fail the calling transaction
    }
  }

  /**
   * Authenticate a private/presence channel subscription request from a client.
   */
  authenticate(
    socketId: string,
    channel: string,
    userData?: { user_id: string; user_info?: unknown },
  ): string {
    if (!this.enabled || !this.client) {
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
