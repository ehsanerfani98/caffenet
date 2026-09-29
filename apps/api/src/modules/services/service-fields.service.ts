import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateServiceFieldDto, UpdateServiceFieldDto, ReorderFieldsDto } from './dto/service-field.dto';
import { ServiceFieldType } from '@caffenet/shared';

/**
 * Service Fields service — admin manages dynamic form fields per service.
 *
 * Supported field types:
 *  - text, textarea
 *  - number
 *  - email, phone
 *  - date, time, datetime
 *  - select (single), multiselect (multiple)
 *  - radio (single choice from list), checkbox (multi choice from list)
 *  - file (any MIME), image (image/* MIME)
 *
 * Storage:
 *  - Field schema in `service_fields` table (JSON columns for validationRules + options)
 *  - Submitted values in `request_field_values` (Phase 4)
 */
@Injectable()
export class ServiceFieldsService {
  private readonly logger = new Logger(ServiceFieldsService.name);

  private readonly OPTION_REQUIRED_TYPES: ServiceFieldType[] = [
    ServiceFieldType.SELECT,
    ServiceFieldType.MULTISELECT,
    ServiceFieldType.RADIO,
    ServiceFieldType.CHECKBOX,
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Add a field to a service.
   */
  async create(serviceId: string, dto: CreateServiceFieldDto, userId: string) {
    await this.assertServiceExists(serviceId);
    this.validateFieldDefinition(dto);

    // Check name uniqueness within service
    const existing = await this.prisma.serviceField.findFirst({
      where: { serviceId: BigInt(serviceId), name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `فیلد با نام «${dto.name}» قبلاً برای این خدمت ثبت شده است`,
      );
    }

    const field = await this.prisma.serviceField.create({
      data: {
        serviceId: BigInt(serviceId),
        label: dto.label,
        name: dto.name,
        type: dto.type,
        placeholder: dto.placeholder,
        helpText: dto.helpText,
        required: dto.required ?? false,
        validationRules: dto.validationRules ?? [],
        defaultValue: dto.defaultValue,
        sortOrder: dto.sortOrder ?? 0,
        options: dto.options,
        active: dto.active ?? true,
      },
    });

    this.logger.log(`Field ${dto.name} added to service ${serviceId} by user ${userId}`);
    return this.serialize(field);
  }

  /**
   * List all fields for a service (admin view — includes inactive).
   */
  async listForAdmin(serviceId: string) {
    await this.assertServiceExists(serviceId);
    const fields = await this.prisma.serviceField.findMany({
      where: { serviceId: BigInt(serviceId) },
      orderBy: { sortOrder: 'asc' },
    });
    return { items: fields.map((f) => this.serialize(f)) };
  }

  /**
   * Update a field.
   */
  async update(serviceId: string, fieldId: string, dto: UpdateServiceFieldDto, userId: string) {
    const field = await this.prisma.serviceField.findFirst({
      where: { id: BigInt(fieldId), serviceId: BigInt(serviceId) },
    });
    if (!field) throw new NotFoundException('فیلد یافت نشد');

    // If changing type to option-based, ensure options are present
    if (dto.options !== undefined && dto.options.length === 0 && this.OPTION_REQUIRED_TYPES.includes(field.type as ServiceFieldType)) {
      throw new BadRequestException(
        `برای نوع «${field.type}» حداقل یک گزینه لازم است`,
      );
    }

    const updated = await this.prisma.serviceField.update({
      where: { id: BigInt(fieldId) },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.placeholder !== undefined ? { placeholder: dto.placeholder } : {}),
        ...(dto.helpText !== undefined ? { helpText: dto.helpText } : {}),
        ...(dto.required !== undefined ? { required: dto.required } : {}),
        ...(dto.validationRules !== undefined ? { validationRules: dto.validationRules } : {}),
        ...(dto.defaultValue !== undefined ? { defaultValue: dto.defaultValue } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.options !== undefined ? { options: dto.options } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });

    this.logger.log(`Field ${fieldId} updated by user ${userId}`);
    return this.serialize(updated);
  }

  /**
   * Delete a field (hard delete — fields don't have history).
   */
  async delete(serviceId: string, fieldId: string, userId: string) {
    const field = await this.prisma.serviceField.findFirst({
      where: { id: BigInt(fieldId), serviceId: BigInt(serviceId) },
    });
    if (!field) throw new NotFoundException('فیلد یافت نشد');

    // Check if any submitted request has values for this field
    const usedCount = await this.prisma.requestFieldValue.count({
      where: { fieldId: BigInt(fieldId) },
    });
    if (usedCount > 0) {
      // Deactivate instead of delete (preserve history)
      await this.prisma.serviceField.update({
        where: { id: BigInt(fieldId) },
        data: { active: false },
      });
      this.logger.log(`Field ${fieldId} deactivated (used in ${usedCount} requests) — soft-deleted by user ${userId}`);
      return { message: 'فیلد در درخواست‌های قبلی استفاده شده — به‌جای حذف، غیرفعال شد' };
    }

    await this.prisma.serviceField.delete({ where: { id: BigInt(fieldId) } });
    this.logger.log(`Field ${fieldId} deleted by user ${userId}`);
    return { message: 'فیلد حذف شد' };
  }

  /**
   * Reorder fields (batch).
   */
  async reorder(serviceId: string, dto: ReorderFieldsDto, userId: string) {
    await this.assertServiceExists(serviceId);
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.serviceField.update({
          where: { id: BigInt(item.id), serviceId: BigInt(serviceId) },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    this.logger.log(`Fields reordered for service ${serviceId} by user ${userId}`);
    return { message: 'ترتیب فیلدها به‌روزرسانی شد' };
  }

  // ==================== HELPERS ====================

  private async assertServiceExists(serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: BigInt(serviceId), deletedAt: null },
    });
    if (!service) throw new NotFoundException('خدمت یافت نشد');
  }

  /**
   * Validate the field definition per type.
   * - Option-based types must have at least one option
   * - File/image types should NOT have options
   * - Validation rules should make sense per type (e.g., pattern only for text)
   */
  private validateFieldDefinition(dto: CreateServiceFieldDto) {
    if (this.OPTION_REQUIRED_TYPES.includes(dto.type)) {
      if (!dto.options || dto.options.length === 0) {
        throw new BadRequestException(
          `برای نوع «${dto.type}» حداقل یک گزینه لازم است`,
        );
      }
      // Validate option uniqueness
      const values = dto.options!.map((o) => o.value);
      if (new Set(values).size !== values.length) {
        throw new BadRequestException('مقادیر گزینه‌ها نباید تکراری باشند');
      }
    } else {
      if (dto.options && dto.options.length > 0) {
        // Options ignored for non-option types
        this.logger.warn(`Options provided for type ${dto.type} — will be ignored`);
      }
    }

    // Validate validation rules per type
    if (dto.validationRules) {
      for (const rule of dto.validationRules) {
        if (rule.type === 'pattern' && !rule.params?.regex) {
          throw new BadRequestException('قانون pattern نیاز به params.regex دارد');
        }
        if ((rule.type === 'min' || rule.type === 'max') && rule.params?.value === undefined) {
          throw new BadRequestException(`قانون ${rule.type} نیاز به params.value دارد`);
        }
      }
    }
  }

  private serialize(f: Record<string, unknown>) {
    return {
      id: f.id?.toString?.() ?? f.id,
      uuid: f.uuid,
      serviceId: f.serviceId?.toString?.() ?? f.serviceId,
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
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
  }
}
