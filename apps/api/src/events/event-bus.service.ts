import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DOMAIN_EVENTS } from '@caffenet/shared';

/**
 * Centralized domain event bus.
 * Domain modules emit events via this service; downstream listeners (notification,
 * realtime, audit) subscribe via @OnEvent decorator.
 *
 * Examples:
 *   this.events.emit(DOMAIN_EVENTS.REQUEST_STATUS_CHANGED, { requestId, oldStatus, newStatus, userId });
 *
 * Listener:
 *   @OnEvent(DOMAIN_EVENTS.REQUEST_STATUS_CHANGED)
 *   handleStatusChanged(payload: RequestStatusChangedPayload) { ... }
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  async emit(event: string, payload: unknown): Promise<void> {
    try {
      this.emitter.emit(event, payload);
    } catch (err) {
      this.logger.error(`Failed to emit event ${event}: ${(err as Error).message}`);
    }
  }

  async emitAsync(event: string, payload: unknown): Promise<void> {
    try {
      await this.emitter.emitAsync(event, payload);
    } catch (err) {
      this.logger.error(`Failed to emitAsync event ${event}: ${(err as Error).message}`);
    }
  }
}
