import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { EventsModule } from '../../events/events.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { WalletModule } from '../wallet/wallet.module';
import { WalletService } from '../wallet/wallet.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ZarinpalGateway } from './gateways/zarinpal.gateway';
import { ZibalGateway } from './gateways/zibal.gateway';

/**
 * PaymentsModule (Phase 6.4) — online payment orchestration with
 * ZarinPal / Zibal adapters and an idempotent, server-verified callback.
 */
@Module({
  imports: [PrismaModule, EventsModule, RealtimeModule, WalletModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, WalletService, ZarinpalGateway, ZibalGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
