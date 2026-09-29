import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, ReorderCategoriesDto, CategoryQueryDto } from './dto/category.dto';

@ApiTags('admin/categories')
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
@Permissions('categories.view')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Post()
  @Permissions('categories.create')
  @ApiOperation({ summary: 'ایجاد دسته‌بندی (فقط ادمین)' })
  async create(@Body() dto: CreateCategoryDto, @CurrentUser() user: { id: string }) {
    return this.categories.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'لیست دسته‌بندی‌ها (ادمین — شامل غیرفعال‌ها)' })
  async list(@Query() query: CategoryQueryDto) {
    return this.categories.listForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات دسته‌بندی' })
  async get(@Param('id') id: string) {
    return this.categories.findById(id);
  }

  @Patch(':id')
  @Permissions('categories.update')
  @ApiOperation({ summary: 'ویرایش دسته‌بندی' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.categories.update(id, dto, user.id);
  }

  @Patch('reorder')
  @Permissions('categories.update')
  @ApiOperation({ summary: 'بازترتیب دسته‌بندی‌ها (batch)' })
  async reorder(@Body() dto: ReorderCategoriesDto, @CurrentUser() user: { id: string }) {
    return this.categories.reorder(dto, user.id);
  }

  @Delete(':id')
  @Permissions('categories.delete')
  @ApiOperation({ summary: 'حذف دسته‌بندی (soft delete)' })
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.categories.softDelete(id, user.id);
  }
}
