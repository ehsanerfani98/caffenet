import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'خدمات اینترنتی', description: 'نام دسته‌بندی (فارسی)' })
  @IsString()
  @Length(2, 255)
  name!: string;

  @ApiPropertyOptional({ example: 'internet-services', description: 'slug — auto-generated if not provided' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug باید فقط شامل حروف کوچک انگلیسی، اعداد و خط تیره باشد' })
  slug?: string;

  @ApiPropertyOptional({ description: 'توضیحات دسته‌بندی' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'wifi', description: 'نام آیکن (لزوم انتخاب از کتابخانه آیکن)' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  icon?: string;

  @ApiPropertyOptional({ description: 'URL تصویر دسته‌بندی' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 0, description: 'ترتیب نمایش (۰=ابتدا)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCategoryDto {
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
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReorderCategoriesDto {
  @ApiProperty({
    description: 'لیست ترتیب جدید — هر مورد شامل id و sortOrder',
    example: [{ id: '1', sortOrder: 0 }, { id: '2', sortOrder: 1 }],
    type: 'array',
  })
  @Type(() => ReorderItem)
  items!: ReorderItem[];
}

class ReorderItem {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class CategoryQueryDto {
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

  @ApiPropertyOptional({ description: 'فیلتر بر اساس active' })
  @IsOptional()
  @Transform(({ value }: { value: string }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'جستجو در نام و توضیحات' })
  @IsOptional()
  @IsString()
  search?: string;
}
