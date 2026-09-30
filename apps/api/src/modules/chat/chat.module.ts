import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatController } from './chat.controller';
import { BroadcastingController } from './broadcasting.controller';
import { ChatService } from './chat.service';

/**
 * Real-time chat module (Phase 10).
 * - ChatController: message history / send / read / delete + rooms list
 * - BroadcastingController: Pusher channel auth + webhook
 * - ChatService: persistence + authorization + live broadcasting
 * - Phase 11: ChatService fans out NewChatMessage notifications via
 *   NotificationService (persist + realtime bell + web push per prefs).
 */
@Module({
  imports: [PrismaModule, RealtimeModule, FilesModule, NotificationsModule],
  controllers: [ChatController, BroadcastingController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
