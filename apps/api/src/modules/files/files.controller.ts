import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ApiBody } from '@nestjs/swagger';
import { IsIn, IsOptional, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesService } from './files.service';

class FileUploadMetadataDto {
  @ApiProperty({ enum: ['public', 'private'], default: 'private' })
  @IsIn(['public', 'private'])
  visibility!: 'public' | 'private';

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}

@ApiTags('files')
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'آپلود فایل (مجاز برای همه کاربران واردشده)' })
  @ApiBody({
    description: 'Multipart form-data: file (binary) + visibility (string, default: private)',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        visibility: { type: 'string', enum: ['public', 'private'], default: 'private' },
      },
      required: ['file'],
    },
  })
  async upload(
    @Req() req: Request,
    @CurrentUser() user: { id: string },
    @Query('visibility') visibility?: 'public' | 'private',
  ) {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return { error: 'فایلی ارسال نشده است', code: 'NO_FILE' };
    }
    return this.files.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      user.id,
      visibility ?? 'private',
    );
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'دریافت URL امضا‌شده برای دانلود فایل خصوصی' })
  async getSignedUrl(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Query('expires') expires?: number,
  ) {
    return this.files.getSignedUrl(id, user.id, expires ?? 300);
  }
}
