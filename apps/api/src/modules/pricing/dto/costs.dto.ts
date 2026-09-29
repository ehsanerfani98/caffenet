import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { PRICING_CONFIG } from '@caffenet/shared';

/**
 * Pricing DTOs (Phase 5.2).
 * Money arrives in Toman (major units) and is converted to Rial (minor,
 * BigInt) server-side via toMinor(). Final totals are computed SERVER-SIDE —
 * the client never sends a total.
 */
export class UpdateRequestCostsDto {
  @ApiPropertyOptional({
    description: 'هزینه مواد (تومان) — ارسال‌نشدن یعنی بدون تغییر',
    example: 250000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(PRICING_CONFIG.MAX_COMPONENT_TOMAN)
  materialCostToman?: number;

  @ApiPropertyOptional({
    description: 'هزینه‌های تکمیلی (تومان) — ارسال‌نشدن یعنی بدون تغییر',
    example: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(PRICING_CONFIG.MAX_COMPONENT_TOMAN)
  additionalCostToman?: number;

  @ApiPropertyOptional({ description: 'دلیل تغییر (ثبت در تاریخچه قیمت)' })
  @IsString()
  @Length(0, PRICING_CONFIG.MAX_REASON_LENGTH)
  reason?: string;
}
