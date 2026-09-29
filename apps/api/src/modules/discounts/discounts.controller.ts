import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiscountsService } from './discounts.service';
import { ApplyDiscountDto, ValidateDiscountDto } from './dto/discount.dto';

/**
 * Discount application endpoints (Phase 5.3.3 / 5.3.4 + 5.2.2).
 *  - POST /api/v1/discounts/validate — preview a code (any authenticated role;
 *    ownership enforced server-side when a requestId is supplied)
 *  - POST /api/v1/discounts/apply — lock a code to a request
 *    (PERMISSION-GATED: `discounts.apply` → operator/admin only)
 *  - POST /api/v1/admin/requests/:id/remove-discount lives in the admin
 *    controller below.
 */
@ApiTags('discounts')
@Controller('discounts')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('customer', 'operator', 'admin')
export class DiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Post('validate')
  @Permissions('requests.view')
  @ApiOperation({ summary: 'اعتبارسنجی و پیش‌نمایش کد تخفیف (بدون اعمال)' })
  async validate(
    @Body() dto: ValidateDiscountDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.discounts.validate(dto, { id: user.id, roles: user.roles });
  }

  @Post('apply')
  @Permissions('discounts.apply')
  @Roles('operator', 'admin')
  @ApiOperation({ summary: 'اعمال کد تخفیف روی درخواست (قفل اتمیک + محاسبه سمت سرور)' })
  async apply(@Body() dto: ApplyDiscountDto, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.discounts.apply(String(dto.requestId), dto, { id: user.id, roles: user.roles });
  }
}

@ApiTags('admin/discounts')
@Controller('admin/requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminDiscountActionsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Post(':id/remove-discount')
  @Permissions('discounts.apply')
  @ApiOperation({ summary: 'حذف تخفیف اعمال‌شده روی درخواست (قبل از صدور فاکتور)' })
  async removeDiscount(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.discounts.removeFromRequest(id, { id: user.id, roles: user.roles });
  }
}
