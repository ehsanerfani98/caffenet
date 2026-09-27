import { Module, Global } from '@nestjs/common';
import { EventBusService } from './event-bus.service';

/**
 * Internal event bus — decouples domain events from their handlers.
 * Uses NestJS EventEmitter2 under the hood (in-memory, single-process).
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
