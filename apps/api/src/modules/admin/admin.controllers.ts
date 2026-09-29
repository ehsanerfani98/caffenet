import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminManagementService } from './admin-management.service';

/**
 * Phase 8/9 — Admin dashboard + management controllers.
 * Convention follows admin-discounts.controller.ts:
 *   JwtAuthGuard + RolesGuard + PermissionsGuard, @Roles('admin'),
 *   per-endpoint @Permissions(...) using the seeded permission catalog.
 */

interface Actor {
  id: string;
  roles: string[];
}

function reqMeta(req: Request) {
  return { ip: req.ip, ua: req.headers['user-agent'] };
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class ListUsersQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perPage?: number;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(50) role?: string;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(255) fullName?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsIn(['pending_otp', 'active', 'suspended', 'banned']) status?: string;
}

export class RoleLinkDto {
  @IsString() roleId!: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(8) @MaxLength(72) newPassword!: string;
}

export class CreateOperatorDto {
  @IsString() phone!: string;
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
  @IsOptional() @IsString() @MaxLength(255) fullName?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
}

export class SetOperatorStatusDto {
  @IsIn(['active', 'suspended']) status!: 'active' | 'suspended';
}

export class CreateRoleDto {
  @IsString() @MinLength(2) @MaxLength(50) name!: string;
  @IsString() @MinLength(2) @MaxLength(50) slug!: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
  @IsArray() @IsString({ each: true }) permissionSlugs!: string[];
}

export class UpdateRolePermissionsDto {
  @IsArray() @IsString({ each: true }) permissionSlugs!: string[];
}

export class UpsertContactMethodDto {
  @IsOptional() @IsString() @MaxLength(50) name?: string;
  @IsOptional() @IsString() @MaxLength(50) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(255) icon?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class ReorderContactMethodsDto {
  @IsArray() @IsString({ each: true }) orderedIds!: string[];
}

export class UpdateSettingsDto {
  @IsArray() entries!: { key: string; value?: string; valueJson?: unknown }[];
}

export class RefundPaymentDto {
  @IsOptional() @Type(() => Number) @Min(1) amountToman?: number;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class BroadcastDto {
  @IsString() @MinLength(2) @MaxLength(255) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) body?: string;
  @IsIn(['all', 'customers', 'operators']) audience!: 'all' | 'customers' | 'operators';
  @IsOptional() @IsIn(['request', 'wallet', 'message', 'system', 'marketing']) type?: string;
}

export class ReportRangeQueryDto {
  @IsOptional() @IsString() from?: string; // ISO date
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsIn(['day', 'month']) granularity?: 'day' | 'month';
}

// ---------------------------------------------------------------------------
// 9.2 — Dashboard
// ---------------------------------------------------------------------------

@ApiTags('admin/dashboard')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  @Permissions('reports.view')
  @ApiOperation({ summary: 'KPI های داشبورد ادمین + فعالیت اخیر (9.2)' })
  async getDashboard() {
    return this.dashboard.getDashboard();
  }

  @Get('charts')
  @Permissions('reports.view')
  @ApiOperation({
    summary: 'داده نمودارها: روند درآمد، وضعیت‌ها، خدمات برتر، نرخ موفقیت پرداخت (9.2.2)',
  })
  async getCharts(@Query() q: ReportRangeQueryDto) {
    const range = this.dashboard.resolveRange(q.from, q.to);
    const [revenue, byStatus, topServices, payments] = await Promise.all([
      this.dashboard.revenueTrend(range, q.granularity ?? 'day'),
      this.dashboard.requestsByStatus(range),
      this.dashboard.topServices(range),
      this.dashboard.paymentStats(range),
    ]);
    return { revenue, byStatus, topServices, payments };
  }
}

// ---------------------------------------------------------------------------
// 9.3 — Users management
// ---------------------------------------------------------------------------

@ApiTags('admin/users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly mgmt: AdminManagementService) {}

  @Get()
  @Permissions('users.view')
  @ApiOperation({ summary: 'لیست کاربران (جستجو/فیلتر نقش و وضعیت) (9.3.1)' })
  async list(@Query() q: ListUsersQueryDto) {
    return this.mgmt.listUsers(q);
  }

  @Get(':id')
  @Permissions('users.view')
  @ApiOperation({ summary: 'جزئیات کاربر + آمار درخواست‌ها و کیف پول (9.3.2 / 9.3.7)' })
  async detail(@Param('id') id: string) {
    return this.mgmt.getUserDetail(id);
  }

  @Patch(':id')
  @Permissions('users.update')
  @ApiOperation({ summary: 'ویرایش کاربر / مسدودسازی و رفع مسدودی (9.3.3 / 9.3.6)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: Actor,
    @Req() req: Request,
  ) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.updateUser(id, dto, user, ip, ua);
  }

  @Post(':id/roles')
  @Permissions('users.update')
  @ApiOperation({ summary: 'اختصاص نقش به کاربر (9.3.4)' })
  async assignRole(
    @Param('id') id: string,
    @Body() dto: RoleLinkDto,
    @CurrentUser() user: Actor,
    @Req() req: Request,
  ) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.assignRole(id, dto.roleId, user, ip, ua);
  }

  @Delete(':id/roles/:roleId')
  @Permissions('users.update')
  @ApiOperation({ summary: 'سلب نقش از کاربر (9.3.4)' })
  async revokeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: Actor,
    @Req() req: Request,
  ) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.revokeRole(id, roleId, user, ip, ua);
  }

  @Post(':id/reset-password')
  @Permissions('users.update')
  @ApiOperation({ summary: 'تنظیم رمز عبور جدید توسط ادمین (9.3.5) — همه نشست‌ها باطل می‌شود' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: Actor,
    @Req() req: Request,
  ) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.resetPassword(id, dto.newPassword, user, ip, ua);
  }
}

// ---------------------------------------------------------------------------
// 9.4 — Operators management
// ---------------------------------------------------------------------------

@ApiTags('admin/operators')
@Controller('admin/operators')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminOperatorsController {
  constructor(private readonly mgmt: AdminManagementService) {}

  @Get()
  @Permissions('operators.view')
  @ApiOperation({ summary: 'لیست اپراتورها + آمار (9.4.1 / 9.4.4)' })
  async list(@Query() q: ListUsersQueryDto) {
    return this.mgmt.listOperators(q);
  }

  @Post()
  @Permissions('operators.create')
  @ApiOperation({ summary: 'ایجاد حساب اپراتور (9.4.2)' })
  async create(@Body() dto: CreateOperatorDto, @CurrentUser() user: Actor, @Req() req: Request) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.createOperator(dto, user, ip, ua);
  }

  @Patch(':id/status')
  @Permissions('operators.deactivate')
  @ApiOperation({ summary: 'فعال/غیرفعال‌سازی اپراتور (9.4.4)' })
  async setStatus(
    @Param('id') id: string,
    @Body() dto: SetOperatorStatusDto,
    @CurrentUser() user: Actor,
    @Req() req: Request,
  ) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.setOperatorStatus(id, dto.status, user, ip, ua);
  }
}

// ---------------------------------------------------------------------------
// 9.5 — Roles & permissions
// ---------------------------------------------------------------------------

@ApiTags('admin/roles')
@Controller('admin/roles')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminRolesController {
  constructor(private readonly mgmt: AdminManagementService) {}

  @Get('permissions')
  @Permissions('roles.view')
  @ApiOperation({ summary: 'کاتالوگ مجوزها به تفکیک گروه (9.5.3)' })
  async listPermissions() {
    return this.mgmt.listPermissions();
  }

  @Get()
  @Permissions('roles.view')
  @ApiOperation({ summary: 'لیست نقش‌ها + مجوزها (9.5.1)' })
  async list() {
    return this.mgmt.listRoles();
  }

  @Post()
  @Permissions('roles.create')
  @ApiOperation({ summary: 'ایجاد نقش جدید (9.5.2)' })
  async create(@Body() dto: CreateRoleDto, @CurrentUser() user: Actor, @Req() req: Request) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.createRole(dto, user, ip, ua);
  }

  @Patch(':id/permissions')
  @Permissions('roles.update')
  @ApiOperation({ summary: 'ویرایش مجوزهای نقش — ماتریس (9.5.3)' })
  async updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: Actor,
    @Req() req: Request,
  ) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.updateRolePermissions(id, dto.permissionSlugs, user, ip, ua);
  }

  @Delete(':id')
  @Permissions('roles.delete')
  @ApiOperation({ summary: 'حذف نقش (سیستمی/دارای کاربر ممنوع) (9.5.4)' })
  async remove(@Param('id') id: string, @CurrentUser() user: Actor, @Req() req: Request) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.deleteRole(id, user, ip, ua);
  }
}

// ---------------------------------------------------------------------------
// 9.9.1 — Contact methods
// ---------------------------------------------------------------------------

@ApiTags('admin/contact-methods')
@Controller('admin/contact-methods')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminContactMethodsController {
  constructor(private readonly mgmt: AdminManagementService) {}

  @Get()
  @Permissions('settings.update')
  @ApiOperation({ summary: 'لیست روش‌های تماس (9.9.1)' })
  async list() {
    return this.mgmt.listContactMethods();
  }

  @Post()
  @Permissions('settings.update')
  @ApiOperation({ summary: 'ایجاد روش تماس' })
  async create(
    @Body() dto: UpsertContactMethodDto,
    @CurrentUser() user: Actor,
    @Req() req: Request,
  ) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.upsertContactMethod(dto, null, user, ip, ua);
  }

  @Patch(':id')
  @Permissions('settings.update')
  @ApiOperation({ summary: 'ویرایش/فعال‌سازی روش تماس' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpsertContactMethodDto,
    @CurrentUser() user: Actor,
    @Req() req: Request,
  ) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.upsertContactMethod(dto, id, user, ip, ua);
  }

  @Patch('reorder')
  @Permissions('settings.update')
  @ApiOperation({ summary: 'مرتب‌سازی روش‌های تماس' })
  async reorder(
    @Body() dto: ReorderContactMethodsDto,
    @CurrentUser() user: Actor,
    @Req() req: Request,
  ) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.reorderContactMethods(dto.orderedIds, user, ip, ua);
  }
}

// ---------------------------------------------------------------------------
// 9.12 — Settings
// ---------------------------------------------------------------------------

@ApiTags('admin/settings')
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminSettingsController {
  constructor(private readonly mgmt: AdminManagementService) {}

  @Get()
  @Permissions('settings.update')
  @ApiOperation({ summary: 'تنظیمات سیستم (مقادیر محرمانه ماسک می‌شوند) (9.12)' })
  async list() {
    return this.mgmt.listSettings();
  }

  @Patch()
  @Permissions('settings.update')
  @ApiOperation({ summary: 'ذخیره تنظیمات (با audit)' })
  async update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: Actor, @Req() req: Request) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.updateSettings(dto.entries, user, ip, ua);
  }
}

// ---------------------------------------------------------------------------
// 9.8 — Wallets / payments / refund
// ---------------------------------------------------------------------------

@ApiTags('admin/finance')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminFinanceController {
  constructor(private readonly mgmt: AdminManagementService) {}

  @Get('wallets')
  @Permissions('wallet.view.all')
  @ApiOperation({ summary: 'کیف پول همه کاربران (9.8.1)' })
  async wallets(@Query() q: ListUsersQueryDto) {
    return this.mgmt.listWallets(q);
  }

  @Get('payments')
  @Permissions('payments.view')
  @ApiOperation({ summary: 'لیست پرداخت‌ها (فیلتر وضعیت/درگاه) (9.8.4)' })
  async payments(@Query() q: ListUsersQueryDto) {
    return this.mgmt.listPayments(q);
  }

  @Post('payments/:id/refund')
  @Permissions('wallet.refund')
  @ApiOperation({ summary: 'بازگشت وجه پرداخت به کیف پول مشتری (9.8.3 / 9.7.4) — با audit' })
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() user: Actor,
    @Req() req: Request,
  ) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.refundPayment(id, dto, user, ip, ua);
  }
}

// ---------------------------------------------------------------------------
// 9.10 — Reports
// ---------------------------------------------------------------------------

@ApiTags('admin/reports')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminReportsController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('financial')
  @Permissions('reports.view')
  @ApiOperation({ summary: 'گزارش مالی: درآمد، تخفیف، بازگشت وجه (9.10.1)' })
  async financial(@Query() q: ReportRangeQueryDto) {
    return this.dashboard.financialReport(this.dashboard.resolveRange(q.from, q.to));
  }

  @Get('services')
  @Permissions('reports.view')
  @ApiOperation({ summary: 'گزارش خدمات: تعداد، درآمد، میانگین زمان (9.10.2)' })
  async services(@Query() q: ReportRangeQueryDto) {
    return this.dashboard.serviceReport(this.dashboard.resolveRange(q.from, q.to));
  }

  @Get('wallet')
  @Permissions('reports.view')
  @ApiOperation({ summary: 'گزارش تراکنش‌های کیف پول به تفکیک نوع (9.10.3)' })
  async wallet(@Query() q: ReportRangeQueryDto) {
    return this.dashboard.walletReport(this.dashboard.resolveRange(q.from, q.to));
  }

  @Get('payments')
  @Permissions('reports.view')
  @ApiOperation({ summary: 'گزارش موفقیت/شکست پرداخت‌ها (9.10.4)' })
  async paymentsReport(@Query() q: ReportRangeQueryDto) {
    return this.dashboard.paymentStats(this.dashboard.resolveRange(q.from, q.to));
  }
}

// ---------------------------------------------------------------------------
// 9.11 — Audit logs
// ---------------------------------------------------------------------------

@ApiTags('admin/audit-logs')
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminAuditLogsController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Permissions('audit_logs.view')
  @ApiOperation({ summary: 'گزارش ممیزی با فیلتر کاربر/اقدام/موجودیت/تاریخ (9.11.1)' })
  async list(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.audit.list({
      userId,
      action,
      entity,
      entityId,
      fromDate: from ? new Date(from) : undefined,
      toDate: to ? new Date(to) : undefined,
      page: Number(page) || 1,
      perPage: Math.min(Number(perPage) || 50, 100),
    });
  }
}

// ---------------------------------------------------------------------------
// 9.9.3 — Broadcast notifications
// ---------------------------------------------------------------------------

@ApiTags('admin/notifications')
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminNotificationsController {
  constructor(private readonly mgmt: AdminManagementService) {}

  @Post('broadcast')
  @Permissions('notifications.send')
  @ApiOperation({ summary: 'ارسال اعلان همگانی (9.9.3) — با audit' })
  async broadcast(@Body() dto: BroadcastDto, @CurrentUser() user: Actor, @Req() req: Request) {
    const { ip, ua } = reqMeta(req);
    return this.mgmt.broadcast(dto, user, ip, ua);
  }

  @Get('broadcasts')
  @Permissions('notifications.view')
  @ApiOperation({ summary: 'تاریخچه اعلان‌های همگانی (9.9.3)' })
  async list(@Query('page') page?: string, @Query('perPage') perPage?: string) {
    return this.mgmt.listBroadcasts(Number(page) || 1, Math.min(Number(perPage) || 20, 100));
  }
}
