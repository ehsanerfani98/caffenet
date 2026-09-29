import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toMinor } from '../../common/utils/money';
import { CreateServiceDto, UpdateServiceDto, ServiceQueryDto } from './dto/service.dto';
import { EventBusService } from '../../events/event-bus.service';

/**
 * Services service — admin CRUD + public read + search.
 *
 * Money convention: DTOs accept amounts in Toman (major units), service
 * converts to Rial (minor units) before storing. This keeps API
 * consumer-friendly while internal storage is always BigInt minor units.
 */
@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  // ==================== ADMIN ====================

  async create(dto: CreateServiceDto, userId: string) {
    const slug = dto.slug ?? this.generateSlug(dto.name);

    // Check category exists
    const category = await this.prisma.category.findFirst({
      where: { id: BigInt(dto.categoryId), deletedAt: null },
    });
    if (!category) throw new NotFoundException('دسته‌بندی یافت نشد');

    // Check slug uniqueness
    const existing = await this.prisma.service.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`خدمت با slug «${slug}» قبلاً ثبت شده است`);
    }

    const service = await this.prisma.service.create({
      data: {
        categoryId: BigInt(dto.categoryId),
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image,
        icon: dto.icon,
        laborFee: BigInt(toMinor(dto.laborFee)),
        defaultMaterialCost: BigInt(toMinor(dto.defaultMaterialCost ?? 0)),
        minMaterialCost: BigInt(toMinor(dto.minMaterialCost ?? 0)),
        maxMaterialCost: dto.maxMaterialCost !== undefined ? BigInt(toMinor(dto.maxMaterialCost)) : null,
        estimatedDurationMin: dto.estimatedDurationMin ?? 60,
        active: dto.active ?? true,
        requiresFile: dto.requiresFile ?? false,
        requiresCustomerInfo: dto.requiresCustomerInfo ?? false,
        currency: 'IRT',
      },
      include: { category: true },
    });

    this.logger.log(`Service created: ${slug} (by user ${userId})`);
    return this.serialize(service);
  }

  async listForAdmin(query: ServiceQueryDto) {
    const page = query.page ?? 1;
    const perPage = Math.min(query.perPage ?? 20, 100);
    const where = {
      deletedAt: null,
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.categoryId ? { categoryId: BigInt(query.categoryId) } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.maxLaborFee ? { laborFee: { lte: BigInt(toMinor(query.maxLaborFee)) } } : {}),
      ...(query.minDuration || query.maxDuration
        ? {
            estimatedDurationMin: {
              ...(query.minDuration ? { gte: query.minDuration } : {}),
              ...(query.maxDuration ? { lte: query.maxDuration } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        include: { category: true, _count: { select: { fields: true } } },
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      items: items.map((s) => this.serialize(s)),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async findById(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: BigInt(id), deletedAt: null },
      include: {
        category: true,
        fields: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!service) throw new NotFoundException('خدمت یافت نشد');
    return this.serializeWithFields(service);
  }

  async update(id: string, dto: UpdateServiceDto, userId: string) {
    const existing = await this.prisma.service.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!existing) throw new NotFoundException('خدمت یافت نشد');

    if (dto.slug && dto.slug !== existing.slug) {
      const conflict = await this.prisma.service.findUnique({ where: { slug: dto.slug } });
      if (conflict) {
        throw new ConflictException(`slug «${dto.slug}» قبلاً استفاده شده است`);
      }
    }

    if (dto.categoryId && dto.categoryId !== Number(existing.categoryId)) {
      const category = await this.prisma.category.findFirst({
        where: { id: BigInt(dto.categoryId), deletedAt: null },
      });
      if (!category) throw new NotFoundException('دسته‌بندی یافت نشد');
    }

    const updated = await this.prisma.service.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.image !== undefined ? { image: dto.image } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: BigInt(dto.categoryId) } : {}),
        ...(dto.laborFee !== undefined ? { laborFee: BigInt(toMinor(dto.laborFee)) } : {}),
        ...(dto.defaultMaterialCost !== undefined
          ? { defaultMaterialCost: BigInt(toMinor(dto.defaultMaterialCost)) }
          : {}),
        ...(dto.minMaterialCost !== undefined
          ? { minMaterialCost: BigInt(toMinor(dto.minMaterialCost)) }
          : {}),
        ...(dto.maxMaterialCost !== undefined
          ? { maxMaterialCost: BigInt(toMinor(dto.maxMaterialCost)) }
          : {}),
        ...(dto.estimatedDurationMin !== undefined ? { estimatedDurationMin: dto.estimatedDurationMin } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.requiresFile !== undefined ? { requiresFile: dto.requiresFile } : {}),
        ...(dto.requiresCustomerInfo !== undefined ? { requiresCustomerInfo: dto.requiresCustomerInfo } : {}),
      },
      include: { category: true },
    });

    this.logger.log(`Service ${id} updated by user ${userId}`);
    return this.serialize(updated);
  }

  async softDelete(id: string, userId: string) {
    const existing = await this.prisma.service.findFirst({
      where: { id: BigInt(id), deletedAt: null },
      include: { _count: { select: { requests: { where: { status: { in: ['pending', 'reviewing', 'in_progress', 'waiting_for_payment', 'waiting_for_customer'] } } } } } },
    });
    if (!existing) throw new NotFoundException('خدمت یافت نشد');

    if (existing._count.requests > 0) {
      throw new ConflictException(
        `این خدمت ${existing._count.requests} درخواست فعال دارد — نمی‌توان آن را حذف کرد`,
      );
    }

    await this.prisma.service.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date(), active: false },
    });
    this.logger.log(`Service ${id} soft-deleted by user ${userId}`);
    return { message: 'خدمت با موفقیت حذف شد' };
  }

  // ==================== PUBLIC ====================

  async listPublic(query: ServiceQueryDto) {
    const page = query.page ?? 1;
    const perPage = Math.min(query.perPage ?? 20, 100);
    const where = {
      active: true,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: BigInt(query.categoryId) } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.maxLaborFee ? { laborFee: { lte: BigInt(toMinor(query.maxLaborFee)) } } : {}),
      ...(query.minDuration || query.maxDuration
        ? {
            estimatedDurationMin: {
              ...(query.minDuration ? { gte: query.minDuration } : {}),
              ...(query.maxDuration ? { lte: query.maxDuration } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        include: { category: true },
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      items: items.map((s) => this.serialize(s)),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async findBySlugPublic(slug: string) {
    const service = await this.prisma.service.findFirst({
      where: { slug, active: true, deletedAt: null },
      include: {
        category: true,
        fields: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!service) throw new NotFoundException('خدمت یافت نشد');
    return this.serializeWithFields(service);
  }

  // ==================== HELPERS ====================

  private generateSlug(name: string): string {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0600-\u06FF-]/g, '')
      .substring(0, 50);
    if (!/^[\w-]+$/.test(slug)) {
      return `svc-${Date.now().toString(36)}`;
    }
    return slug;
  }

  private serialize(s: Record<string, unknown> & { _count?: { fields?: number } }) {
    return {
      id: s.id?.toString?.() ?? s.id,
      uuid: s.uuid,
      categoryId: s.categoryId?.toString?.() ?? s.categoryId,
      category: s.category
        ? {
            id: (s.category as Record<string, unknown>).id?.toString(),
            name: (s.category as Record<string, unknown>).name,
            slug: (s.category as Record<string, unknown>).slug,
            icon: (s.category as Record<string, unknown>).icon,
          }
        : undefined,
      name: s.name,
      slug: s.slug,
      description: s.description,
      image: s.image,
      icon: s.icon,
      // Convert BigInt minor units → major Toman for display
      laborFee: Number(s.laborFee) / 100,
      defaultMaterialCost: Number(s.defaultMaterialCost) / 100,
      minMaterialCost: Number(s.minMaterialCost) / 100,
      maxMaterialCost: s.maxMaterialCost ? Number(s.maxMaterialCost) / 100 : null,
      estimatedDurationMin: s.estimatedDurationMin,
      active: s.active,
      requiresFile: s.requiresFile,
      requiresCustomerInfo: s.requiresCustomerInfo,
      currency: s.currency,
      fieldsCount: s._count?.fields,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  private serializeWithFields(s: Record<string, unknown> & { fields?: Array<Record<string, unknown>> }) {
    return {
      ...this.serialize(s),
      fields: (s.fields ?? []).map((f) => ({
        id: f.id?.toString?.() ?? f.id,
        uuid: f.uuid,
        label: f.label,
        name: f.name,
        type: f.type,
        placeholder: f.placeholder,
        helpText: f.helpText,
        required: f.required,
        validationRules: f.validationRules,
        defaultValue: f.defaultValue,
        sortOrder: f.sortOrder,
        options: f.options,
        active: f.active,
      })),
    };
  }
}
