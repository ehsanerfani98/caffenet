import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { DiscountsService } from './discounts.service';
import { AdminDiscountsController } from './admin-discounts.controller';
import { DiscountsController, AdminDiscountActionsController } from './discounts.controller';

/**
 * Discounts module — Phase 5.3 (+ 5.2.2 permission-gated application).
 *
 * Depends on PricingModule for RequestCostsService (single source of truth
 * for final-total computation, history rows and price-change events).
 */
@Module({
  imports: [AuthModule, PricingModule],
  controllers: [DiscountsController, AdminDiscountsController, AdminDiscountActionsController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
