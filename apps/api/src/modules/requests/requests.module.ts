import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentsModule } from '../payments/payments.module';
import { ServicesModule } from '../services/services.module';
import { FilesModule } from '../files/files.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { RequestsService } from './requests.service';
import { RequestWorkflowService } from './request-workflow.service';
import { RequestAssignmentService } from './request-assignment.service';
import { RequestHistoryService } from './request-history.service';
import { RequestPaymentService } from './request-payment.service';
import { CustomerRequestsController } from './customer-requests.controller';
import { OperatorRequestsController } from './operator-requests.controller';
import { AdminRequestsController } from './admin-requests.controller';

/**
 * Requests module — Phase 4 (Request Management + Status Workflow).
 *
 * Dependencies:
 *  - AuthModule      → JwtAuthGuard + strategy
 *  - ServicesModule  → DynamicFormValidator (server-side form validation)
 *  - FilesModule     → attachment signed URLs
 *  - InvoicesModule  → auto-invoice generation on waiting_for_payment (Phase 5.4.3)
 * RealtimeModule / EventsModule / AuditModule are @Global — no import needed.
 */
@Module({
  imports: [AuthModule, ServicesModule, FilesModule, InvoicesModule, WalletModule, PaymentsModule],
  controllers: [CustomerRequestsController, OperatorRequestsController, AdminRequestsController],
  providers: [
    RequestsService,
    RequestWorkflowService,
    RequestAssignmentService,
    RequestHistoryService,
    RequestPaymentService,
  ],
  exports: [RequestsService, RequestWorkflowService],
})
export class RequestsModule {}
