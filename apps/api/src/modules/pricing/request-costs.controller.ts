import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestCostsService } from './request-costs.service';

/**
 * Price-breakdown read endpoints (Phase 5.1 / 5.2).
 *  - GET /api/v1/requests/:id/costs — PriceBreakdown (customer: own / operator: assigned / admin: all)
 *  - GET /api/v1/requests/:id/cost-history — full audit trail of cost changes
 * Authorization is enforced in the service layer.
 */
@ApiTags('requests')
@Controller('requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('customer', 'operator', 'admin')
@Permissions('requests.view')
export class RequestCostsController {
  constructor(private readonly costs: RequestCostsService) {}

  @Get(':id/costs')
  @ApiOperation({ summary: 'تفکیک قیمت درخواست (اجاره + مواد + تکمیلی − تخفیف = نهایی)' })
  async getCosts(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.costs.getCosts(id, { id: user.id, roles: user.roles });
  }

  @Get(':id/cost-history')
  @ApiOperation({ summary: 'تاریخچه تغییرات قیمت (ممیزی کامل)' })
  async getCostHistory(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.costs.getCostHistory(id, { id: user.id, roles: user.roles });
  }
}
