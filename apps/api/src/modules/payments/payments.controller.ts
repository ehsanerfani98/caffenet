import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { PaymentGatewayName } from '@caffenet/shared';

/**
 * Payments endpoints (Phase 6.4.6–6.4.10).
 *
 * GET /payments/callback is PUBLIC — it is hit by the payment gateway's
 * redirect of the customer's browser. All verification is done server-side.
 */
@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** 6.4.6 — create a payment (wallet top-up; use /requests/:id/pay for requests) */
  @Post()
  @Roles('customer', 'operator', 'admin')
  @ApiOperation({ summary: 'ایجاد پرداخت آنلاین (شارژ کیف پول)' })
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreatePaymentDto) {
    return this.payments.createPayment({
      userId: user.id,
      amountToman: dto.amountToman,
      gateway: dto.gateway as PaymentGatewayName | undefined,
      description: dto.description,
      mobile: dto.mobile,
    });
  }

  /** 6.4.8 — gateway callback (public, idempotent, server-side verified) */
  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'بازگشت از درگاه پرداخت (عمومی — تأیید سمت سرور)' })
  async callback(@Req() req: ExpressRequest) {
    const query = Object.fromEntries(
      Object.entries(req.query as Record<string, string | string[]>).map(([k, v]) => [
        k,
        Array.isArray(v) ? v[0] : v,
      ]),
    );
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const result = await this.payments.handleCallback({
      query,
      method: req.method,
      path: req.path,
      headers,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  /** 6.4.7 — get one payment */
  @Get(':id')
  @Roles('customer', 'operator', 'admin')
  @ApiOperation({ summary: 'مشاهده پرداخت' })
  async getOne(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.payments.findById(id, user.id, user.roles.includes('admin'));
  }

  /** 6.4.10 — manual re-verify */
  @Post(':id/verify')
  @Roles('customer', 'operator', 'admin')
  @ApiOperation({ summary: 'تأیید مجدد دستی پرداخت' })
  async manualVerify(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.payments.manualVerify(id, user.id, user.roles.includes('admin'));
  }

  @Get()
  @Roles('customer', 'operator', 'admin')
  @ApiOperation({ summary: 'فهرست پرداخت‌های من' })
  async listMine(
    @CurrentUser() user: { id: string },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.payments.listMine(
      user.id,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    );
  }
}
