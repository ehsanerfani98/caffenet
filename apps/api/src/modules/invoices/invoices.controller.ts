import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvoicesService } from './invoices.service';

/**
 * Invoice endpoints (Phase 5.4.4 / 5.4.5).
 *  - GET  /api/v1/invoices           — own invoices (admin: all)
 *  - GET  /api/v1/invoices/:id       — by id (customer: own / operator: assigned / admin)
 *  - GET  /api/v1/invoices/number/:n — by invoice number (same rules)
 *  - GET  /api/v1/invoices/:id/download — PDF (rendered server-side from the snapshot)
 * Authorization is enforced in the service layer.
 */
@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('customer', 'operator', 'admin')
@Permissions('invoices.view')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'لیست فاکتورهای من (ادمین: همه)' })
  async list(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @CurrentUser() user: { id: string; roles: string[] } = { id: '', roles: [] },
  ) {
    return this.invoices.listMine(
      { id: user.id, roles: user.roles },
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(perPage) || 20)),
    );
  }

  @Get('number/:invoiceNumber')
  @ApiOperation({ summary: 'مشاهده فاکتور با شماره فاکتور' })
  async findByNumber(
    @Param('invoiceNumber') invoiceNumber: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.invoices.findByNumber(invoiceNumber, { id: user.id, roles: user.roles });
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'دانلود فاکتور PDF (رندر سمت سرور با فونت فارسی)' })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: string[] },
    @Res() res: Response,
  ) {
    const { filename, buffer } = await this.invoices.downloadPdf(id, {
      id: user.id,
      roles: user.roles,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'مشاهده فاکتور (مشتری: خودش / اپراتور: تخصیص‌یافته / ادمین: همه)' })
  async findById(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.invoices.findById(id, { id: user.id, roles: user.roles });
  }
}
