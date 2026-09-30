import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMIT_CONFIG } from '@caffenet/shared';
import { ChatService, ActorInfo } from './chat.service';
import { ListMessagesQueryDto, MarkReadDto, SendTextMessageDto } from './dto/chat.dto';

class FileMessageDto {
  @ApiPropertyOptional({ description: 'متن توضیح اختیاری پیام', maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  caption?: string;
}

class RoomQueryDto {
  @ApiPropertyOptional({ description: 'شماره صفحه' })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'تعداد در هر صفحه' })
  @IsOptional()
  limit?: number;
}

/**
 * Chat endpoints (Phase 10.3).
 * Message routes live under /requests/:id/messages to match the TASKS.md API
 * contract; room helpers live under /chat.
 */
@ApiTags('chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  // ---------- Rooms ----------

  @Get('chat/rooms')
  @ApiOperation({ summary: 'لیست اتاق‌های گفتگوی من (با شمارندهٔ خوانده‌نشده)' })
  async rooms(@CurrentUser() user: ActorInfo, @Query() query: RoomQueryDto) {
    return this.chat.listRooms(user, query);
  }

  @Get('chat/unread-count')
  @ApiOperation({ summary: 'مجموع پیام‌های خوانده‌نشدهٔ من (badge)' })
  async unreadCount(@CurrentUser() user: ActorInfo) {
    return this.chat.unreadCount(user);
  }

  // ---------- Messages of a request ----------

  @Get('requests/:id/messages')
  @ApiOperation({ summary: 'تاریخچه پیام‌های درخواست (صفحه‌بندی کرسری)' })
  async listMessages(
    @Param('id') id: string,
    @Query() query: ListMessagesQueryDto,
    @CurrentUser() user: ActorInfo,
  ) {
    return this.chat.listMessages(id, user, query);
  }

  @Post('requests/:id/messages')
  @Throttle({ default: { limit: RATE_LIMIT_CONFIG.MESSAGE_SEND_PER_MIN, ttl: 60_000 } })
  @ApiOperation({ summary: 'ارسال پیام متنی' })
  async sendText(
    @Param('id') id: string,
    @Body() dto: SendTextMessageDto,
    @CurrentUser() user: ActorInfo,
  ) {
    return this.chat.sendText(id, user, dto);
  }

  @Post('requests/:id/messages/file')
  @Throttle({ default: { limit: RATE_LIMIT_CONFIG.MESSAGE_SEND_PER_MIN, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Multipart: file (binary) + caption (optional)',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'ارسال پیام تصویر/فایل' })
  async sendFile(
    @Param('id') id: string,
    @Req() req: ExpressRequest,
    @Body() dto: FileMessageDto,
    @CurrentUser() user: ActorInfo,
  ) {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return { error: 'فایلی ارسال نشده است', code: 'NO_FILE' };
    }
    return this.chat.sendFile(
      id,
      user,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      dto.caption,
    );
  }

  @Post('requests/:id/messages/:messageId/read')
  @ApiOperation({ summary: 'نشانه‌گذاری پیام‌ها تا این پیام به‌عنوان خوانده‌شده' })
  async markRead(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: MarkReadDto,
    @CurrentUser() user: ActorInfo,
  ) {
    // `all` sentinel (or omitted body) marks every unread incoming message
    const until = dto.messageId ?? (/^\d+$/.test(messageId) ? messageId : undefined);
    return this.chat.markRead(id, user, { messageId: until });
  }

  @Delete('requests/:id/messages/:messageId')
  @ApiOperation({ summary: 'حذف نرم پیام (فقط فرستنده / ادمین)' })
  async deleteMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: ActorInfo,
  ) {
    return this.chat.deleteMessage(id, messageId, user);
  }
}
