import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServicesService } from './services.service';
import { ServiceFieldsService } from './service-fields.service';
import { CreateServiceDto, UpdateServiceDto, ServiceQueryDto } from './dto/service.dto';
import { CreateServiceFieldDto, UpdateServiceFieldDto, ReorderFieldsDto } from './dto/service-field.dto';

@ApiTags('admin/services')
@Controller('admin/services')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
@Permissions('services.view')
export class AdminServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly fields: ServiceFieldsService,
  ) {}

  // ==================== SERVICE CRUD ====================

  @Post()
  @Permissions('services.create')
  @ApiOperation({ summary: 'ایجاد خدمت جدید' })
  async create(@Body() dto: CreateServiceDto, @CurrentUser() user: { id: string }) {
    return this.services.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'لیست خدمات (ادمین)' })
  async list(@Query() query: ServiceQueryDto) {
    return this.services.listForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات خدمت + فیلدها' })
  async get(@Param('id') id: string) {
    return this.services.findById(id);
  }

  @Patch(':id')
  @Permissions('services.update')
  @ApiOperation({ summary: 'ویرایش خدمت' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.services.update(id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('services.delete')
  @ApiOperation({ summary: 'حذف خدمت (soft delete)' })
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.services.softDelete(id, user.id);
  }

  // ==================== FIELD MANAGEMENT ====================

  @Post(':serviceId/fields')
  @Permissions('services.update')
  @ApiOperation({ summary: 'افزودن فیلد به فرم خدمت' })
  async addField(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateServiceFieldDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.fields.create(serviceId, dto, user.id);
  }

  @Get(':serviceId/fields')
  @ApiOperation({ summary: 'لیست همه فیلدهای خدمت (شامل غیرفعال)' })
  async listFields(@Param('serviceId') serviceId: string) {
    return this.fields.listForAdmin(serviceId);
  }

  @Patch(':serviceId/fields/:fieldId')
  @Permissions('services.update')
  @ApiOperation({ summary: 'ویرایش فیلد' })
  async updateField(
    @Param('serviceId') serviceId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateServiceFieldDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.fields.update(serviceId, fieldId, dto, user.id);
  }

  @Delete(':serviceId/fields/:fieldId')
  @Permissions('services.delete')
  @ApiOperation({ summary: 'حذف فیلد' })
  async deleteField(
    @Param('serviceId') serviceId: string,
    @Param('fieldId') fieldId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.fields.delete(serviceId, fieldId, user.id);
  }

  @Patch(':serviceId/fields/reorder')
  @Permissions('services.update')
  @ApiOperation({ summary: 'بازترتیب فیلدها' })
  async reorderFields(
    @Param('serviceId') serviceId: string,
    @Body() dto: ReorderFieldsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.fields.reorder(serviceId, dto, user.id);
  }
}
