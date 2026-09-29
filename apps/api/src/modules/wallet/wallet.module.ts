import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { EventsModule } from '../../events/events.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WalletEventListener } from './wallet.event-listener';

/**
 * WalletModule (Phase 6.1–6.3) — atomic wallet + immutable ledger.
 * Exported so PaymentsModule and RequestsModule can reuse WalletService.
 */
@Module({
  imports: [PrismaModule, EventsModule, RealtimeModule],
  controllers: [WalletController],
  providers: [WalletService, WalletEventListener],
  exports: [WalletService],
})
export class WalletModule {}
