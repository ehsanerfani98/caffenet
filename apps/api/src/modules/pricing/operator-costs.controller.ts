import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestCostsService } from './request-costs.service';
import { UpdateRequestCostsDto } from './dto/costs.dto';

/**
 * Operator cost-management endpoints (Phase 5.2.1).
 *  - PATCH /api/v1/operator/requests/:id/costs — set material + additional
 *  - Final totals computed SERVER-SIDE; negative totals rejected
 *  - Every change is history-logged + event-emitted + audited
 *  - Admin passes through this controller too (superset powers)
 */
@ApiTags('operator/requests')
@Controller('operator/requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('operator', 'admin')
@Permissions('pricing.update')
export class OperatorCostsController {
  constructor(private readonly costs: RequestCostsService) {}

  @Patch(':id/costs')
  @ApiOperation({
    summary: 'ثبت هزینه مواد و هزینه‌های تکمیلی (قیمت نهایی سمت سرور محاسبه می‌شود)',
  })
  async updateCosts(
    @Param('id') id: string,
    @Body() dto: UpdateRequestCostsDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.costs.updateCosts(id, dto, { id: user.id, roles: user.roles });
  }
}
