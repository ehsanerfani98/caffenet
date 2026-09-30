/**
 * Notification endpoints (Phase 11.3) — in-app list/read/delete + preferences.
 *
 *  GET    /notifications              (11.3.1 — paginated, unread first)
 *  GET    /notifications/unread-count (11.3.4)
 *  POST   /notifications/:id/read     (11.3.2)
 *  POST   /notifications/read-all     (11.3.3)
 *  DELETE /notifications/:id          (11.3.5)
 *  GET    /notifications/preferences  (11.3.6)
 *  PUT    /notifications/preferences  (11.3.6)
 *  GET    /notifications/vapid-public-key (11.4.1 — for pushManager.subscribe)
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  NotFoundException,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationService } from './notification.service';
import { applyGroupUpdate, toGroupView, type StoredPrefs } from './notification-preferences';
import { ListNotificationsDto, UpdatePreferencesDto } from './notifications.dto';
import { PushService } from './push.service';

interface Actor {
  id: string;
}

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly push: PushService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'لیست اعلان‌های من (خوانده‌نشده‌ها اول)' })
  async list(@CurrentUser() user: Actor, @Query() query: ListNotificationsDto) {
    return this.notifications.list(user.id, {
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly,
      type: query.type,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'تعداد اعلان‌های خوانده‌نشده (badge زنگولک)' })
  async unreadCount(@CurrentUser() user: Actor) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'تنظیمات اعلان‌ها (نمای گروهی برای کلاینت)' })
  async getPreferences(@CurrentUser() user: Actor) {
    const stored = await this.notifications.getStoredPrefs(user.id);
    return toGroupView(stored);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'به‌روزرسانی تنظیمات اعلان‌ها (گروهی)' })
  async updatePreferences(@CurrentUser() user: Actor, @Body() dto: UpdatePreferencesDto) {
    const stored = await this.notifications.getStoredPrefs(user.id);
    const next = applyGroupUpdate(stored as StoredPrefs, dto);
    await this.notifications.saveStoredPrefs(user.id, next);
    return toGroupView(next);
  }

  @Get('vapid-public-key')
  @ApiOperation({ summary: 'کلید عمومی VAPID برای pushManager.subscribe' })
  vapidPublicKey() {
    return { publicKey: this.push.vapidPublicKey || null, enabled: this.push.isEnabled };
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'علامت‌گذاری همه به‌عنوان خوانده‌شده' })
  async readAll(@CurrentUser() user: Actor) {
    return { updated: await this.notifications.markAllRead(user.id) };
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'علامت‌گذاری یک اعلان به‌عنوان خوانده‌شده' })
  async markRead(@CurrentUser() user: Actor, @Param('id') id: string) {
    const updated = await this.notifications.markRead(user.id, id);
    if (!updated) throw new NotFoundException('اعلان یافت نشد');
    return updated;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف یک اعلان' })
  async remove(@CurrentUser() user: Actor, @Param('id') id: string) {
    const deleted = await this.notifications.remove(user.id, id);
    if (!deleted) throw new NotFoundException('اعلان یافت نشد');
    return { ok: true };
  }
}
