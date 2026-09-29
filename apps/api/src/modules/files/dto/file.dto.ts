import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class FileUploadResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  uuid!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  storedName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  size!: string; // BigInt → string

  @ApiProperty({ description: 'Local driver: relative path. S3 driver: S3 key.' })
  path!: string;

  @ApiProperty({ required: false, description: 'Public URL (only for public files)' })
  url?: string;

  @ApiProperty({ enum: ['public', 'private'] })
  visibility!: 'public' | 'private';
}

export class FileVisibilityDto {
  @ApiProperty({ enum: ['public', 'private'] })
  @IsIn(['public', 'private'])
  visibility!: 'public' | 'private';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
