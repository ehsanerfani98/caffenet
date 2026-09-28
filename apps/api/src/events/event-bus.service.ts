import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Centralized domain event bus.
 * Domain modules emit events via this service; downstream listeners (notification,
 * realtime, audit) subscribe via @OnEvent decorator.
 *
 * Examples:
 *   this.events.emit('auth.login.success', { userId, ... });
 *   this.events.emit('auth.password.changed', { userId, ... });
 *   this.events.emit('role.assigned', { ... });
 *   this.events.emit('setting.changed', { ... });
 *
 * Listener:
 *   @OnEvent('auth.login.success')
 *   handleLoginSuccess(payload: LoginSuccessPayload) { ... }
 *
 * Wildcards are enabled in AppModule's EventEmitterModule.forRoot() — so
 * 'audit.*' would match 'audit.log', 'audit.error', etc.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  /**
   * Emit an event synchronously (listeners run in parallel, fire-and-forget).
   * Use this for non-critical events where listener failures don't matter.
   */
  async emit(event: string, payload: unknown): Promise<void> {
    try {
      const result = this.emitter.emit(event, payload);
      if (Array.isArray(result)) {
        await Promise.allSettled(result);
      }
    } catch (err) {
      this.logger.error(`Failed to emit event ${event}: ${(err as Error).message}`);
    }
  }

  /**
   * Emit an event and await all listeners (useful when listeners must complete
   * before the calling transaction commits — e.g. audit logging).
   */
  async emitAsync(event: string, payload: unknown): Promise<void> {
    try {
      await this.emitter.emitAsync(event, payload);
    } catch (err) {
      this.logger.error(`Failed to emitAsync event ${event}: ${(err as Error).message}`);
    }
  }
}
