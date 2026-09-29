import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsMobilePhone, IsOptional, IsPositive, Length, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { WALLET_CONFIG } from '@caffenet/shared';

export class CreatePaymentDto {
  @ApiProperty({ description: 'مبلغ (تومان)', example: 100000 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(WALLET_CONFIG.MAX_DEPOSIT_AMOUNT / 100) // 500,000 Toman ceiling
  amountToman!: number;

  @ApiPropertyOptional({ enum: ['zarinpal', 'zibal'] })
  @IsOptional()
  @IsEnum(['zarinpal', 'zibal'])
  gateway?: 'zarinpal' | 'zibal';

  @ApiPropertyOptional({ description: 'توضیح' })
  @IsOptional()
  @Length(0, 255)
  description?: string;

  @ApiPropertyOptional({ description: 'موبایل مشتری (اختیاری)' })
  @IsOptional()
  @IsMobilePhone('fa-IR')
  mobile?: string;
}
