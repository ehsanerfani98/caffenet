import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';
import { NotificationsController } from './notifications.controller';
import { PushController } from './push.controller';
import { NotificationEventListener } from './notification.event-listener';
import { MailModule } from '../mail/mail.module';

/**
 * Notifications module (Phase 11) — in-app + real-time + Web Push + email/SMS
 * dispatch pipeline.
 *
 * Prisma / Realtime / Queue / Sms are global modules, so only MailModule needs
 * an explicit import. The NotificationService is exported for ChatService
 * (NewChatMessage) and the queue worker job handlers.
 */
@Module({
  imports: [MailModule],
  controllers: [NotificationsController, PushController],
  providers: [NotificationService, PushService, NotificationEventListener],
  exports: [NotificationService, PushService],
})
export class NotificationsModule {}
