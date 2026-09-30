/**
 * Notification DTOs (Phase 11.3) — class-validator DTOs with Persian messages.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListNotificationsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'شماره صفحه باید عدد صحیح باشد' })
  @Min(1, { message: 'شماره صفحه حداقل ۱ است' })
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'تعداد آیتم باید عدد صحیح باشد' })
  @Min(1, { message: 'تعداد آیتم حداقل ۱ است' })
  @Max(50, { message: 'تعداد آیتم حداکثر ۵۰ است' })
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'فقط خوانده‌نشده‌ها' })
  @IsOptional()
  @IsBoolean({ message: 'مقدار unreadOnly باید بولین باشد' })
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'فیلتر بر اساس نوع اعلان' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;
}

export class ReadNotificationDto {
  @ApiProperty({ description: 'شناسه عددی یا UUID اعلان' })
  @IsString()
  @MaxLength(64)
  id!: string;
}

export class UpdatePreferencesDto {
  /** Group toggles — each channel flag applies to every type in the group. */
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  requests?: {
    inApp?: boolean;
    push?: boolean;
    email?: boolean;
    sms?: boolean;
  };

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  wallet?: {
    inApp?: boolean;
    push?: boolean;
    email?: boolean;
    sms?: boolean;
  };

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  messages?: {
    inApp?: boolean;
    push?: boolean;
    email?: boolean;
    sms?: boolean;
  };

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  marketing?: {
    inApp?: boolean;
    push?: boolean;
    email?: boolean;
    sms?: boolean;
  };

  /** Master Web Push switch. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;
}

export class PushSubscribeDto {
  @ApiProperty({ description: 'PushSubscription.endpoint from the browser' })
  @IsString()
  @MaxLength(500, { message: 'آدرس endpoint نامعتبر است' })
  endpoint!: string;

  @ApiProperty({ type: Object, description: '{ p256dh, auth } keys' })
  @IsObject()
  keys!: { p256dh?: string; auth?: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;

  @ApiPropertyOptional({ enum: ['mobile', 'tablet', 'desktop'] })
  @IsOptional()
  @IsIn(['mobile', 'tablet', 'desktop'], { message: 'نوع دستگاه نامعتبر است' })
  deviceType?: string;
}

export class PushUnsubscribeDto {
  @ApiProperty({ description: 'PushSubscription.endpoint to remove' })
  @IsString()
  @MaxLength(500)
  endpoint!: string;
}
