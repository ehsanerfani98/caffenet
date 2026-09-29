import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RequestCostsService } from './request-costs.service';
import { OperatorCostsController } from './operator-costs.controller';
import { RequestCostsController } from './request-costs.controller';

/**
 * Pricing module — Phase 5.1 + 5.2 (Pricing Snapshot + Cost Management).
 *
 * Money rules:
 *  - DB: BigInt minor units (Rial). DTOs: Toman. Integer math ONLY.
 *  - FinalTotal = Labor + Material + Additional − Discount (server-side).
 *  - Every mutation → RequestCostHistory rows + request.price_changed event.
 *
 * Discount mutations are owned by DiscountsModule which calls into
 * RequestCostsService (exported below) to keep the recompute logic single-source.
 */
@Module({
  imports: [AuthModule],
  controllers: [OperatorCostsController, RequestCostsController],
  providers: [RequestCostsService],
  exports: [RequestCostsService],
})
export class PricingModule {}
