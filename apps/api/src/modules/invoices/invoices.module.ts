import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';

/**
 * Invoices module — Phase 5.4.
 *
 * InvoicesService is exported so RequestsModule (RequestWorkflowService) can
 * auto-generate the invoice INSIDE the same Serializable transaction that
 * moves a request into `waiting_for_payment` (5.4.3) — atomic with the
 * status transition.
 */
@Module({
  imports: [AuthModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
