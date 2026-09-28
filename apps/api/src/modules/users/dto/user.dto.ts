import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'علی رضایی' })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  fullName?: string;

  @ApiPropertyOptional({ example: 'ali@example.com' })
  @IsOptional()
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'فرمت ایمیل نامعتبر است' })
  email?: string;

  @ApiPropertyOptional({ description: 'شناسه روش ارتباطی ترجیحی (اختیاری)' })
  @IsOptional()
  @IsString()
  preferredContactMethodId?: string;
}
