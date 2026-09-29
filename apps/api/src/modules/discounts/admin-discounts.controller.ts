import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto, ListDiscountQueryDto, UpdateDiscountDto } from './dto/discount.dto';

/**
 * Admin CRUD for discount codes (Phase 5.3.5).
 *  - Create / update / delete / list / usage history
 *  - Codes with recorded usages can NOT be hard-deleted (audit preservation) —
 *    deactivate them instead (409).
 */
@ApiTags('admin/discounts')
@Controller('admin/discounts')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class AdminDiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Post()
  @Permissions('discounts.create')
  @ApiOperation({ summary: 'ایجاد کد تخفیف جدید' })
  async create(
    @Body() dto: CreateDiscountDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.discounts.create(dto, { id: user.id, roles: user.roles });
  }

  @Get()
  @Permissions('discounts.view')
  @ApiOperation({ summary: 'لیست کدهای تخفیف (صفحه‌بندی + فیلتر)' })
  async list(@Query() query: ListDiscountQueryDto) {
    return this.discounts.list(query);
  }

  @Get(':id/usages')
  @Permissions('discounts.view')
  @ApiOperation({ summary: 'سابقه استفاده از یک کد تخفیف' })
  async usages(@Param('id') id: string) {
    return this.discounts.getUsages(id);
  }

  @Patch(':id')
  @Permissions('discounts.update')
  @ApiOperation({ summary: 'ویرایش کد تخفیف (فعال‌سازی/غیرفعال‌سازی، مقادیر و محدودیت‌ها)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.discounts.update(id, dto, { id: user.id, roles: user.roles });
  }

  @Delete(':id')
  @Permissions('discounts.delete')
  @ApiOperation({ summary: 'حذف کد تخفیف (فقط در صورت عدم استفاده)' })
  async remove(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.discounts.remove(id, { id: user.id, roles: user.roles });
  }
}
