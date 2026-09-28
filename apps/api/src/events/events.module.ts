import { Module, Global } from '@nestjs/common';
import { EventBusService } from './event-bus.service';

/**
 * Internal event bus — exposes EventBusService which wraps EventEmitter2.
 *
 * Note: EventEmitterModule.forRoot() is registered in AppModule directly.
 * This module just provides the EventBusService wrapper.
 *
 * For multi-process / multi-server deployment (VPS with multiple PM2 instances),
 * we'd need a Redis-backed event bus. For Phase 1 single-instance is fine.
 */
@Global()
@Module({
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventsModule {}
