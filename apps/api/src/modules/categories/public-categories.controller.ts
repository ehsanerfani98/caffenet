import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CategoriesService } from './categories.service';

/**
 * Public categories endpoint — only active categories, no auth required.
 * Used by the customer-facing UI to browse the catalog.
 */
@ApiTags('categories')
@Controller('categories')
@Public()
export class PublicCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'لیست دسته‌بندی‌های فعال (public)' })
  async list() {
    return this.categories.listPublic();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'جزئیات دسته‌بندی با خدمات آن' })
  async findBySlug(@Param('slug') slug: string) {
    return this.categories.findBySlugPublic(slug);
  }
}
