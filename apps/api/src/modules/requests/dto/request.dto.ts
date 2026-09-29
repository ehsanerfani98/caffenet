import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { REQUEST_OPERATOR_STATUSES } from '@caffenet/shared';

/**
 * Request DTOs (Phase 4).
 * Notes:
 *  - Money amounts arrive in Toman (major units) and are converted to Rial
 *    (minor units) server-side via toMinor().
 *  - `formData` is the raw dynamic-form payload keyed by field name; it is
 *    validated SERVER-SIDE by DynamicFormValidator against the service's
 *    active fields. Never trust the client.
 */
export class CreateRequestDto {
  @ApiProperty({ example: '1', description: 'شناسه خدمت' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serviceId!: number;

  @ApiPropertyOptional({
    description: 'مقادیر فیلدهای فرم پویا (key = نام فیلد)',
    example: { tracking_code: 'RR123456789IR', weight: 2 },
  })
  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'توضیح آزاد مشتری' })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @ApiPropertyOptional({
    description: 'روش تماس موردنظر (slug) — مثال: phone, telegram, whatsapp',
    example: 'phone',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  contactMethod?: string;

  @ApiPropertyOptional({
    description: 'مقدار تماس (شماره/آیدی) — در صورت خالی بودن از پروفایل کاربر استفاده می‌شود',
    example: '09121234567',
  })
  @IsOptional()
  @IsString()
  @Length(3, 255)
  contactValue?: string;

  @ApiPropertyOptional({
    description: 'شناسه فایل‌های آپلودشده برای پیوست (از POST /files/upload)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  fileIds?: string[];
}

export class RequestQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;

  /** Cursor-based pagination for high-volume access (base64 of id) — takes precedence over page. */
  @ApiPropertyOptional({ description: 'کرسر صفحه‌بندی (برای لیست‌های حجیم)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'فیلتر وضعیت (تکرارپذیر با کاما)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serviceId?: number;

  @ApiPropertyOptional({ description: 'جستجو در کد رهگیری / توضیحات' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  search?: string;

  /** operator scope: mine (default) | all — admin ignores this and sees all. */
  @ApiPropertyOptional({
    enum: ['mine', 'all'],
    default: 'mine',
    description: 'اپراتور: فقط درخواست‌های خودم یا همه',
  })
  @IsOptional()
  @IsIn(['mine', 'all'])
  scope?: 'mine' | 'all';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}

export class CancelRequestDto {
  @ApiProperty({ description: 'دلیل لغو درخواست' })
  @IsString()
  @Length(5, 2000)
  reason!: string;
}

export class UpdateRequestStatusDto {
  @ApiProperty({
    enum: [...REQUEST_OPERATOR_STATUSES, 'paid'],
    description: 'وضعیت جدید (paid فقط توسط ادمین/سیستم)',
    example: 'in_progress',
  })
  @IsString()
  @IsIn([...REQUEST_OPERATOR_STATUSES, 'paid'])
  status!: string;

  @ApiPropertyOptional({ description: 'یادداشت تراکنش وضعیت (اختیاری)' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  note?: string;
}

export class AssignRequestDto {
  @ApiPropertyOptional({
    description: 'شناسه اپراتور — خالی = خودم (اپراتور) یا auto-assign',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  operatorId?: number;

  @ApiPropertyOptional({ description: 'یادداشت تخصیص' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;

  @ApiPropertyOptional({
    enum: ['round_robin', 'least_load'],
    description: 'استراتژی auto-assign (وقتی operatorId ارسال نشود)',
  })
  @IsOptional()
  @IsIn(['round_robin', 'least_load'])
  strategy?: 'round_robin' | 'least_load';
}

export class UnassignRequestDto {
  @ApiPropertyOptional({ description: 'یادداشت رفع تخصیص' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;
}

export class AddAttachmentDto {
  @ApiProperty({ description: 'شناسه فایل آپلودشده (POST /files/upload)', example: '42' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileId!: number;
}

export class TrackingCodeParam {
  @ApiProperty({ example: 'CF-2026-000123' })
  @IsString()
  @Matches(/^CF-\d{4}-\d{4,10}$/, {
    message: 'فرمت کد رهگیری صحیح نیست (CF-YYYY-NNNNNN)',
  })
  trackingCode!: string;
}
