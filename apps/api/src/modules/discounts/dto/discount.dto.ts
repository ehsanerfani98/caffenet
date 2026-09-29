import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { DISCOUNT_CONFIG } from '@caffenet/shared';

/** Code pattern: latin letters/digits/underscore/dash, 3–50 chars (5.3.1). */
export class ValidateDiscountDto {
  @ApiProperty({ description: 'کد تخفیف', example: 'WELCOME10' })
  @IsString()
  @Matches(DISCOUNT_CONFIG.CODE_PATTERN, {
    message: 'کد تخفیف فقط می‌تواند شامل حروف انگلیسی، عدد، خط تیره و زیرخط باشد (۳ تا ۵۰ نویسه)',
  })
  code!: string;

  @ApiPropertyOptional({ description: 'شناسه درخواست برای پیش‌نمایش مبلغ تخفیف' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestId?: number;
}

export class ApplyDiscountDto {
  @ApiProperty({ description: 'کد تخفیف', example: 'WELCOME10' })
  @IsString()
  @Matches(DISCOUNT_CONFIG.CODE_PATTERN, {
    message: 'کد تخفیف فقط می‌تواند شامل حروف انگلیسی، عدد، خط تیره و زیرخط باشد (۳ تا ۵۰ نویسه)',
  })
  code!: string;

  @ApiProperty({ description: 'شناسه درخواست هدف' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestId!: number;

  @ApiPropertyOptional({ description: 'دلیل ثبت (تاریخچه قیمت)' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}

export class CreateDiscountDto {
  @ApiProperty({ description: 'کد تخفیف (یکتا)', example: 'WELCOME10' })
  @IsString()
  @Matches(DISCOUNT_CONFIG.CODE_PATTERN, {
    message: 'کد تخفیف فقط می‌تواند شامل حروف انگلیسی، عدد، خط تیره و زیرخط باشد (۳ تا ۵۰ نویسه)',
  })
  code!: string;

  @ApiProperty({ enum: ['percent', 'fixed'], description: 'نوع تخفیف' })
  @IsIn(['percent', 'fixed'])
  type!: 'percent' | 'fixed';

  @ApiProperty({
    description: 'percent → 1..100 | fixed → مبلغ (تومان)',
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DISCOUNT_CONFIG.MAX_FIXED_VALUE_TOMAN)
  valueToman!: number;

  @ApiPropertyOptional({ description: 'حداقل مبلغ سفارش برای اعمال (تومان)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrderAmountToman?: number;

  @ApiPropertyOptional({ description: 'سقف مبلغ تخفیف (تومان) — فقط برای percent' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxDiscountAmountToman?: number;

  @ApiPropertyOptional({ description: 'سقف کل تعداد استفاده' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ description: 'سقف استفاده per-user' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimitPerUser?: number;

  @ApiProperty({ description: 'شروع اعتبار (ISO 8601)' })
  @IsISO8601()
  startsAt!: string;

  @ApiPropertyOptional({ description: 'پایان اعتبار (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'فعال/غیرفعال', default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateDiscountDto {
  @ApiPropertyOptional({ description: 'فعال/غیرفعال' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'مقدار جدید (تومان / درصد)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DISCOUNT_CONFIG.MAX_FIXED_VALUE_TOMAN)
  valueToman?: number;

  @ApiPropertyOptional({ description: 'حداقل مبلغ سفارش (تومان)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrderAmountToman?: number;

  @ApiPropertyOptional({ description: 'سقف مبلغ تخفیف (تومان)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxDiscountAmountToman?: number;

  @ApiPropertyOptional({ description: 'سقف کل تعداد استفاده' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ description: 'سقف استفاده per-user' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimitPerUser?: number;

  @ApiPropertyOptional({ description: 'پایان اعتبار (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class ListDiscountQueryDto {
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

  @ApiPropertyOptional({ enum: ['all', 'active', 'inactive'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'active', 'inactive'])
  active?: 'all' | 'active' | 'inactive';

  @ApiPropertyOptional({ description: 'جستجو در کد' })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  search?: string;
}
