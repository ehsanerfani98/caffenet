import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ServiceFieldType } from '@caffenet/shared';

export class ServiceFieldOptionDto {
  @ApiProperty({ example: 'urgent', description: 'مقدار گزینه' })
  @IsString()
  value!: string;

  @ApiProperty({ example: 'فوری', description: 'برچسب گزینه' })
  @IsString()
  label!: string;

  @ApiPropertyOptional({ default: false, description: 'گزینه پیش‌فرض؟' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ValidationRuleDto {
  @ApiProperty({ example: 'min', description: 'نوع اعتبارسنجی: min|max|pattern|enum|custom' })
  @IsString()
  type!: string;

  @ApiPropertyOptional({ description: 'پارامتر اعتبارسنجی (عدد، رشته، یا آرایه)' })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'حداقل ۳ کاراکتر', description: 'پیام خطای فارسی' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class CreateServiceFieldDto {
  @ApiProperty({ example: 'کد رهگیری', description: 'برچسب فیلد (فارسی)' })
  @IsString()
  @Length(1, 255)
  label!: string;

  @ApiProperty({ example: 'tracking_code', description: 'نام فیلد (snake_case انگلیسی)' })
  @IsString()
  @MatchesSnakeCase()
  name!: string;

  @ApiProperty({ enum: ServiceFieldType, description: 'نوع فیلد' })
  @IsEnum(ServiceFieldType)
  type!: ServiceFieldType;

  @ApiPropertyOptional({ description: 'متن راهنما' })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional({ description: 'متن کمکی زیر فیلد' })
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: 'قوانین اعتبارسنجی', type: 'array' })
  @IsOptional()
  @IsArray()
  @Type(() => ValidationRuleDto)
  validationRules?: ValidationRuleDto[];

  @ApiPropertyOptional({ description: 'مقدار پیش‌فرض' })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({ default: 0, description: 'ترتیب نمایش' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'گزینه‌ها (برای select, multiselect, radio, checkbox)',
    type: 'array',
  })
  @ValidateIf((o) =>
    [ServiceFieldType.SELECT, ServiceFieldType.MULTISELECT, ServiceFieldType.RADIO, ServiceFieldType.CHECKBOX]
      .includes(o.type),
  )
  @IsArray()
  @Type(() => ServiceFieldOptionDto)
  options?: ServiceFieldOptionDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// Custom decorator for snake_case validation
function MatchesSnakeCase() {
  return function (target: object, propertyKey: string) {
    // Use class-validator's Matches decorator logic
    const { Matches } = require('class-validator');
    return Matches(/^[a-z][a-z0-9_]*$/ as unknown as RegExp, {
      message: '$property باید snake_case باشد (حروف کوچک انگلیسی، اعداد، و زیرخط)',
    })(target as never, propertyKey) as never;
  };
}

export class UpdateServiceFieldDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  @Type(() => ValidationRuleDto)
  validationRules?: ValidationRuleDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  @Type(() => ServiceFieldOptionDto)
  options?: ServiceFieldOptionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReorderFieldsDto {
  @ApiProperty({ type: 'array' })
  @IsArray()
  @Type(() => ReorderFieldItem)
  items!: ReorderFieldItem[];
}

class ReorderFieldItem {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  sortOrder!: number;
}
