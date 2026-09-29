import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ServicesService } from './services.service';
import { ServiceQueryDto } from './dto/service.dto';

/**
 * Public services endpoint — only active services, no auth required.
 * Used by the customer-facing UI to browse and search the catalog.
 */
@ApiTags('services')
@Controller('services')
@Public()
export class PublicServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'لیست خدمات فعال با فیلتر و جستجو (public)' })
  async list(@Query() query: ServiceQueryDto) {
    return this.services.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'جزئیات خدمت + فیلدهای فرم (public)' })
  async findBySlug(@Param('slug') slug: string) {
    return this.services.findBySlugPublic(slug);
  }
}
