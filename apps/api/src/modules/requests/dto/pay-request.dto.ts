import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export class PayRequestDto {
  @ApiProperty({ enum: ['wallet', 'online'], description: 'روش پرداخت' })
  @IsEnum(['wallet', 'online'])
  method!: 'wallet' | 'online';

  @ApiPropertyOptional({ enum: ['zarinpal', 'zibal'], description: 'فقط برای روش آنلاین' })
  @IsOptional()
  @IsEnum(['zarinpal', 'zibal'])
  gateway?: 'zarinpal' | 'zibal';
}
