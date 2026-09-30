import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Chat DTOs (Phase 10.3).
 */

export class ListMessagesQueryDto {
  @ApiPropertyOptional({
    description: 'کرسر صفحه‌بندی (از meta.nextCursor پاسخ قبلی)',
  })
  @IsOptional()
  @IsString()
  before?: string;

  @ApiPropertyOptional({ description: 'تعداد پیام در هر صفحه', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}

export class SendTextMessageDto {
  @ApiProperty({ description: 'متن پیام', minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1, { message: 'متن پیام نمی‌تواند خالی باشد' })
  @MaxLength(4000, { message: 'متن پیام حداکثر ۴۰۰۰ کاراکتر است' })
  body!: string;
}

export class MarkReadDto {
  @ApiPropertyOptional({
    description: 'تا این پیام خوانده شود (اختیاری؛ پیش‌فرض همهٔ پیام‌های خوانده‌نشده)',
  })
  @IsOptional()
  @IsString()
  messageId?: string;
}
