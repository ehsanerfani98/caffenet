import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto, ReorderCategoriesDto, CategoryQueryDto } from './dto/category.dto';
import { EventBusService } from '../../events/event-bus.service';

/**
 * Categories service — admin CRUD + public read.
 *
 * Categories are soft-deletable (deletedAt set) to preserve referential integrity
 * with existing services and requests.
 *
 * Slug auto-generation: if slug not provided, generate from name (Persian → kebab-case
 * via transliteration).
 */
@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  // ==================== ADMIN ====================

  async create(dto: CreateCategoryDto, userId: string) {
    const slug = dto.slug ?? this.generateSlug(dto.name);

    // Check slug uniqueness
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`دسته‌بندی با slug «${slug}» قبلاً ثبت شده است`);
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        icon: dto.icon,
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
      },
    });
    this.logger.log(`Category created: ${slug} (by user ${userId})`);
    return this.serialize(category);
  }

  async listForAdmin(query: CategoryQueryDto) {
    const page = query.page ?? 1;
    const perPage = Math.min(query.perPage ?? 20, 100);
    const where = {
      deletedAt: null,
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      items: items.map((c) => this.serialize(c)),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async findById(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: BigInt(id), deletedAt: null },
      include: { _count: { select: { services: { where: { deletedAt: null } } } } },
    });
    if (!category) throw new NotFoundException('دسته‌بندی یافت نشد');
    return this.serialize(category);
  }

  async update(id: string, dto: UpdateCategoryDto, userId: string) {
    const existing = await this.prisma.category.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!existing) throw new NotFoundException('دسته‌بندی یافت نشد');

    if (dto.slug && dto.slug !== existing.slug) {
      const conflict = await this.prisma.category.findUnique({ where: { slug: dto.slug } });
      if (conflict) {
        throw new ConflictException(`slug «${dto.slug}» قبلاً استفاده شده است`);
      }
    }

    const updated = await this.prisma.category.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    this.logger.log(`Category ${id} updated by user ${userId}`);
    return this.serialize(updated);
  }

  async softDelete(id: string, userId: string) {
    const existing = await this.prisma.category.findFirst({
      where: { id: BigInt(id), deletedAt: null },
      include: { _count: { select: { services: { where: { deletedAt: null } } } } },
    });
    if (!existing) throw new NotFoundException('دسته‌بندی یافت نشد');

    if (existing._count.services > 0) {
      throw new ConflictException(
        `این دسته‌بندی شامل ${existing._count.services} خدمت فعال است — ابتدا آن‌ها را حذف یا به دسته‌بندی دیگری منتقل کنید`,
      );
    }

    await this.prisma.category.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date(), active: false },
    });
    this.logger.log(`Category ${id} soft-deleted by user ${userId}`);
    return { message: 'دسته‌بندی با موفقیت حذف شد' };
  }

  async reorder(dto: ReorderCategoriesDto, userId: string) {
    // Atomic reorder — all or nothing
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.category.update({
          where: { id: BigInt(item.id) },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    this.logger.log(`Categories reordered by user ${userId} (${dto.items.length} items)`);
    return { message: 'ترتیب دسته‌بندی‌ها به‌روزرسانی شد' };
  }

  // ==================== PUBLIC ====================

  async listPublic() {
    // Only active categories, sorted by sortOrder
    const items = await this.prisma.category.findMany({
      where: { active: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { services: { where: { active: true, deletedAt: null } } } } },
    });
    return {
      items: items.map((c) => ({
        ...this.serialize(c),
        servicesCount: c._count.services,
      })),
    };
  }

  async findBySlugPublic(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug, active: true, deletedAt: null },
      include: {
        services: {
          where: { active: true, deletedAt: null },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!category) throw new NotFoundException('دسته‌بندی یافت نشد');
    return {
      ...this.serialize(category),
      services: category.services.map((s) => ({
        id: s.id.toString(),
        uuid: s.uuid,
        slug: s.slug,
        name: s.name,
        description: s.description,
        icon: s.icon,
        imageUrl: s.image,
        laborFee: s.laborFee.toString(),
        estimatedDurationMin: s.estimatedDurationMin,
      })),
    };
  }

  // ==================== HELPERS ====================

  /**
   * Generate slug from Persian name (transliteration to kebab-case English).
   * Falls back to timestamp-based slug if name is fully Persian.
   */
  private generateSlug(name: string): string {
    // Simple slugify — for Persian, just lowercase + replace spaces with dashes
    // For full transliteration, use a library like speakingurl
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0600-\u06FF-]/g, '')
      .substring(0, 50);
    // If still all-Persian, add a suffix
    if (!/^[\w-]+$/.test(slug)) {
      return `cat-${Date.now().toString(36)}`;
    }
    return slug;
  }

  private serialize(cat: Record<string, unknown>) {
    return {
      id: cat.id?.toString?.() ?? cat.id,
      uuid: cat.uuid,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      imageUrl: cat.imageUrl,
      sortOrder: cat.sortOrder,
      active: cat.active,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      deletedAt: cat.deletedAt,
    };
  }
}
