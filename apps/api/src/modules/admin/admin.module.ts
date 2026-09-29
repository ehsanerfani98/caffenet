import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import {
  AdminContactMethodsController,
  AdminDashboardController,
  AdminFinanceController,
  AdminNotificationsController,
  AdminOperatorsController,
  AdminReportsController,
  AdminRolesController,
  AdminSettingsController,
  AdminAuditLogsController,
  AdminUsersController,
} from './admin.controllers';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminManagementService } from './admin-management.service';

/**
 * Phase 8/9 — Admin dashboard & management.
 * AuthModule + AuditModule are global: JwtAuthGuard is importable and
 * AuditService is available without import. WalletModule is needed for
 * refunds (WalletService.manualAdjustment backs the refund flow).
 */
@Module({
  imports: [WalletModule],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminOperatorsController,
    AdminRolesController,
    AdminContactMethodsController,
    AdminSettingsController,
    AdminFinanceController,
    AdminReportsController,
    AdminAuditLogsController,
    AdminNotificationsController,
  ],
  providers: [AdminDashboardService, AdminManagementService],
})
export class AdminModule {}
