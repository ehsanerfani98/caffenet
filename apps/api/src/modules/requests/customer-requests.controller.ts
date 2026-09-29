import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestsService } from './requests.service';
import { RequestHistoryService } from './request-history.service';
import { RequestPaymentService } from './request-payment.service';
import { PayRequestDto } from './dto/pay-request.dto';
import {
  AddAttachmentDto,
  CancelRequestDto,
  CreateRequestDto,
  RequestQueryDto,
} from './dto/request.dto';
import { RATE_LIMIT_CONFIG } from '@caffenet/shared';

/**
 * Customer-facing request endpoints (Phase 4.1).
 * Customers work on their OWN requests only — enforced in the service layer.
 */
@ApiTags('requests')
@Controller('requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('customer', 'admin', 'operator')
export class CustomerRequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly history: RequestHistoryService,
    private readonly requestPayment: RequestPaymentService,
  ) {}

  @Post()
  @Throttle({ default: { limit: RATE_LIMIT_CONFIG.REQUEST_CREATE_PER_MIN, ttl: 60_000 } })
  @Permissions('requests.create')
  @ApiOperation({ summary: 'ثبت درخواست جدید (با اعتبارسنجی سمت سرور فرم پویا)' })
  async create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.requests.create(dto, user.id);
  }

  @Get()
  @Permissions('requests.view')
  @ApiOperation({ summary: 'لیست درخواست‌های من (مشتری)' })
  async list(
    @Query() query: RequestQueryDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.requests.list(query, { id: user.id, roles: user.roles });
  }

  @Get('attachments/:requestId')
  @Permissions('requests.view')
  @ApiOperation({ summary: 'لیست پیوست‌های درخواست' })
  async listAttachments(
    @Param('requestId') requestId: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.requests.listAttachments(requestId, { id: user.id, roles: user.roles });
  }

  @Post(':id/attachments')
  @Permissions('requests.update')
  @ApiOperation({ summary: 'افزودن پیوست به درخواست' })
  async addAttachment(
    @Param('id') id: string,
    @Body() dto: AddAttachmentDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.requests.addAttachment(id, dto, { id: user.id, roles: user.roles });
  }

  @Get(':trackingCode/by-code')
  @Permissions('requests.view')
  @ApiOperation({ summary: 'پیگیری درخواست با کد رهگیری (مشتری: فقط مالک)' })
  async findByTrackingCode(
    @Param('trackingCode') trackingCode: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.requests.findByTrackingCode(trackingCode, { id: user.id, roles: user.roles });
  }

  @Get(':id/history')
  @Permissions('requests.view')
  @ApiOperation({ summary: 'تاریخچه وضعیت‌های درخواست' })
  async getHistory(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.history.getHistory(id, { id: user.id, roles: user.roles });
  }

  @Get(':id/timeline')
  @Permissions('requests.view')
  @ApiOperation({ summary: 'تایم‌لاین یکپارچه درخواست (برای UI)' })
  async getTimeline(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.history.getTimeline(id, { id: user.id, roles: user.roles });
  }

  @Get(':id')
  @Permissions('requests.view')
  @ApiOperation({ summary: 'جزئیات کامل درخواست' })
  async findById(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.requests.findById(id, { id: user.id, roles: user.roles });
  }

  @Post(':id/pay')
  @Permissions('requests.view')
  @ApiOperation({ summary: 'پرداخت درخواست (کیف پول یا درگاه آنلاین) — فاز ۶' })
  async pay(
    @Param('id') id: string,
    @Body() dto: PayRequestDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.requestPayment.payRequest({
      userId: user.id,
      requestId: id,
      method: dto.method,
      gateway: dto.gateway,
    });
  }

  @Patch(':id/cancel')
  @Permissions('requests.cancel')
  @ApiOperation({ summary: 'لغو درخواست توسط مشتری (فقط در وضعیت‌های مجاز)' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelRequestDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.requests.cancel(id, dto, { id: user.id, roles: user.roles });
  }
}
