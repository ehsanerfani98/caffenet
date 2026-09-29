import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ example: 'تکمیل فرم رهگیری مرسولات' })
  @IsString()
  @Length(2, 255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'تصویر خدمت' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 'truck' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ example: '1', description: 'ID دسته‌بندی' })
  @Type(() => Number)
  @IsInt()
  categoryId!: number;

  @ApiProperty({ example: '50000', description: 'دستمزد پایه (تومان)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  laborFee!: number; // major units (Toman), will be ×100 to Rial

  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultMaterialCost?: number;

  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minMaterialCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxMaterialCost?: number;

  @ApiPropertyOptional({ example: 60, description: 'مدت زمان تقریبی (دقیقه)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  estimatedDurationMin?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: false, description: 'آیا خدمت نیازمند آپلود فایل است؟' })
  @IsOptional()
  @IsBoolean()
  requiresFile?: boolean;

  @ApiPropertyOptional({ default: false, description: 'آیا خدمت نیازمند اطلاعات مشتری است؟' })
  @IsOptional()
  @IsBoolean()
  requiresCustomerInfo?: boolean;
}

export class UpdateServiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'دستمزد به تومان' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  laborFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultMaterialCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minMaterialCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxMaterialCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  estimatedDurationMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresFile?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresCustomerInfo?: boolean;
}

export class ServiceQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  @ApiPropertyOptional({ description: 'جستجو در نام و توضیحات' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'فیلتر بر اساس دسته‌بندی' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'حداکثر دستمزد (تومان)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxLaborFee?: number;

  @ApiPropertyOptional({ description: 'حداقل مدت زمان (دقیقه)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDuration?: number;

  @ApiPropertyOptional({ description: 'حداکثر مدت زمان (دقیقه)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(1440)
  maxDuration?: number;

  @ApiPropertyOptional({ description: 'فیلتر بر اساس active' })
  @IsOptional()
  @Transform(({ value }: { value: string }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;
}

// Re-export for admin list query
export { ServiceQueryDto as AdminServiceQueryDto };
