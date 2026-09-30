import { Injectable, Logger } from '@nestjs/common';
import { PusherService } from './pusher.service';
import { PUSHER_CONFIG } from '@caffenet/shared';

/**
 * Domain-friendly real-time publisher.
 * Wraps PusherService with domain-specific helpers.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly pusher: PusherService) {}

  /** Notify all parties of a request about status change */
  async notifyRequestStatusChanged(requestId: string | number, data: unknown): Promise<void> {
    const channel = PUSHER_CONFIG.PRIVATE_REQUEST_CHANNEL(requestId);
    await this.pusher.trigger(channel, 'RequestStatusChanged', data);
  }

  /** Notify all parties of a request about price change */
  async notifyRequestPriceChanged(requestId: string | number, data: unknown): Promise<void> {
    const channel = PUSHER_CONFIG.PRIVATE_REQUEST_CHANNEL(requestId);
    await this.pusher.trigger(channel, 'RequestPriceChanged', data);
  }

  /** Notify a single user (notification bell, wallet update, payment result) */
  async notifyUser(userId: string | number, event: string, data: unknown): Promise<void> {
    const channel = PUSHER_CONFIG.PRIVATE_USER_CHANNEL(userId);
    await this.pusher.trigger(channel, event, data);
  }

  /** Notify all admins (broadcast) */
  async notifyAdmins(event: string, data: unknown): Promise<void> {
    await this.pusher.trigger(PUSHER_CONFIG.PRIVATE_ADMIN_CHANNEL, event, data);
  }

  /** Broadcast a new chat message to a request room */
  async broadcastMessage(requestId: string | number, message: unknown): Promise<void> {
    const channel = PUSHER_CONFIG.PRIVATE_REQUEST_CHANNEL(requestId);
    await this.pusher.trigger(channel, 'MessageSent', message);
  }

  /** Mark a message as read by another party */
  async notifyMessageRead(requestId: string | number, data: unknown): Promise<void> {
    const channel = PUSHER_CONFIG.PRIVATE_REQUEST_CHANNEL(requestId);
    await this.pusher.trigger(channel, 'MessageRead', data);
  }

  /** Ensure the DB-configured Pusher client is ready before authenticateChannel. */
  async ensureReady(): Promise<boolean> {
    return this.pusher.isReady();
  }

  /** Public/secret key pair of the ACTIVE Pusher app (webhook HMAC check). */
  async getCredentials(): Promise<{ key: string; secret: string } | null> {
    return this.pusher.getCredentials();
  }

  /** Authenticate a private/presence channel subscription */
  authenticateChannel(
    socketId: string,
    channel: string,
    user?: { user_id: string; user_info?: unknown },
  ): string {
    return this.pusher.authenticate(socketId, channel, user);
  }
}
