import {
  Inject,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { EventBusService } from '../../events/event-bus.service';
import { FilesService } from '../files/files.service';
import { NotificationService } from '../notifications/notification.service';
import { STORAGE_TOKEN, IStorage } from '../../storage/interfaces/storage.interface';

export interface ActorInfo {
  id: string;
  roles: string[];
}

type DbMessage = {
  id: bigint;
  uuid: string;
  roomId: bigint;
  senderId: bigint;
  type: string;
  body: string | null;
  metadata: unknown;
  readAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  sender?: { id: bigint; fullName: string | null; phone: string } | null;
  attachments?: Array<DbAttachment>;
};

type DbAttachment = {
  id: bigint;
  fileId: bigint;
  fileName: string;
  fileSize: bigint;
  mimeType: string;
  file?: { path: string; visibility: string };
};

const MESSAGE_FILE_TYPES: Record<string, string> = {
  image: 'image',
  video: 'file',
  audio: 'file',
  application: 'file',
  text: 'file',
};

/**
 * Real-time chat service (Phase 10).
 *
 * Rooms are 1:1 per request (customer ↔ assigned operator ↔ admin observer).
 * Messages are persisted in `messages` (+ `message_attachments`) and broadcast
 * live over Pusher on `private-request.{requestId}`.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly events: EventBusService,
    private readonly files: FilesService,
    private readonly notifications: NotificationService,
    @Inject(STORAGE_TOKEN) private readonly storage: IStorage,
  ) {}

  // ==================== ROOM / ACCESS ====================

  /**
   * Find or create the chat room of a request and keep participants in sync
   * (customer + currently-assigned operator). Re-assignment adds the new
   * operator as participant; old rows are kept for history.
   */
  async ensureRoom(requestId: bigint, tx?: Pick<PrismaService, 'chatRoom' | 'chatParticipant'>) {
    const db = tx ?? this.prisma;
    const request = await (db as PrismaService).request.findUnique({
      where: { id: requestId },
      select: { id: true, customerId: true, assignedOperatorId: true },
    });
    if (!request) throw new NotFoundException('درخواست یافت نشد');

    const room = await db.chatRoom.upsert({
      where: { requestId },
      update: {},
      create: { requestId, type: 'request' },
    });

    const participantIds = new Set<string>([request.customerId.toString()]);
    if (request.assignedOperatorId) {
      participantIds.add(request.assignedOperatorId.toString());
    }
    for (const userId of participantIds) {
      const role = userId === request.customerId.toString() ? 'customer' : 'operator';
      await db.chatParticipant.upsert({
        where: { roomId_userId: { roomId: room.id, userId: BigInt(userId) } },
        update: {},
        create: { roomId: room.id, userId: BigInt(userId), role },
      });
    }
    return { room, request };
  }

  /** 10.3.6 — Authorization: customer(owner) / assigned operator / admin. */
  private assertRoomAccess(
    request: { customerId: bigint; assignedOperatorId: bigint | null },
    actor: ActorInfo,
  ): void {
    if (actor.roles.includes('admin')) return;
    if (request.customerId.toString() === actor.id) return;
    if (actor.roles.includes('operator') && request.assignedOperatorId?.toString() === actor.id) {
      return;
    }
    throw new ForbiddenException('شما به گفتگوی این درخواست دسترسی ندارید');
  }

  /** Resolve request + enforce access, creating the room lazily on first use. */
  async resolveRoom(requestId: string, actor: ActorInfo) {
    const id = this.toId(requestId);
    const request = await this.prisma.request.findUnique({
      where: { id },
      select: { id: true, customerId: true, assignedOperatorId: true },
    });
    if (!request) throw new NotFoundException('درخواست یافت نشد');
    this.assertRoomAccess(request, actor);
    const { room } = await this.ensureRoom(id);
    return { room, request };
  }

  // ==================== ROOMS LIST ====================

  /**
   * Rooms of the current user (customer: own requests; operator: assigned;
   * admin: all) with last message + unread badge.
   */
  async listRooms(actor: ActorInfo, query: { page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));

    const where = {
      ...(actor.roles.includes('admin')
        ? {}
        : actor.roles.includes('operator')
          ? {
              request: { assignedOperatorId: BigInt(actor.id) },
            }
          : { request: { customerId: BigInt(actor.id) } }),
    };

    const [total, rooms] = await Promise.all([
      this.prisma.chatRoom.count({ where }),
      this.prisma.chatRoom.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          request: {
            select: {
              id: true,
              trackingCode: true,
              status: true,
              service: { select: { name: true } },
              customer: { select: { id: true, fullName: true, phone: true } },
            },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              type: true,
              body: true,
              senderId: true,
              createdAt: true,
              sender: { select: { fullName: true } },
            },
          },
        },
      }),
    ]);

    const roomIds = rooms.map((r) => r.id);
    const unreadRows = roomIds.length
      ? await this.prisma.message.groupBy({
          by: ['roomId'],
          where: {
            roomId: { in: roomIds },
            senderId: { not: BigInt(actor.id) },
            readAt: null,
            deletedAt: null,
          },
          _count: { _all: true },
        })
      : [];
    const unreadMap = new Map(unreadRows.map((r) => [r.roomId.toString(), r._count._all]));

    return {
      items: rooms.map((room) => {
        const last = room.messages[0];
        return {
          id: room.id.toString(),
          uuid: room.uuid,
          requestId: room.request.id.toString(),
          type: room.type,
          updatedAt: room.updatedAt,
          request: {
            id: room.request.id.toString(),
            trackingCode: room.request.trackingCode,
            status: room.request.status,
            serviceName: room.request.service?.name ?? null,
            customer: room.request.customer
              ? {
                  id: room.request.customer.id.toString(),
                  fullName: room.request.customer.fullName,
                  phone: room.request.customer.phone,
                }
              : null,
          },
          lastMessage: last
            ? {
                id: last.id.toString(),
                type: last.type,
                body: last.type === 'text' ? last.body : null,
                senderId: last.senderId.toString(),
                senderName: last.sender?.fullName ?? null,
                isMine: last.senderId.toString() === actor.id,
                createdAt: last.createdAt,
              }
            : null,
          unreadCount: unreadMap.get(room.id.toString()) ?? 0,
        };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  // ==================== MESSAGES ====================

  /** 10.3.1 — Cursor-based paginated message history (newest page first). */
  async listMessages(
    requestId: string,
    actor: ActorInfo,
    query: { before?: string; limit?: number },
  ) {
    const { room } = await this.resolveRoom(requestId, actor);
    const limit = Math.min(100, Math.max(1, query.limit ?? 30));
    const before = query.before ? this.decodeCursor(query.before) : null;

    const messages = await this.prisma.message.findMany({
      where: {
        roomId: room.id,
        ...(before ? { id: { lt: before } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: {
        sender: { select: { id: true, fullName: true, phone: true } },
        attachments: { include: { file: { select: { path: true, visibility: true } } } },
      },
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const serialized = await Promise.all(page.map((m) => this.serializeMessage(m, actor)));
    // ascending for UI (page was fetched descending)
    const items = page
      .map((m, i) => ({ id: m.id, msg: serialized[i]! }))
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((x) => x.msg);

    return {
      items,
      meta: {
        hasMore,
        nextCursor: hasMore ? this.encodeCursor(page[0]!.id) : null,
      },
    };
  }

  /** 10.3.2 + 10.4.1 — Send a text message and broadcast it live. */
  async sendText(requestId: string, actor: ActorInfo, dto: { body: string }) {
    const { room, request } = await this.resolveRoom(requestId, actor);
    const message = await this.prisma.message.create({
      data: {
        roomId: room.id,
        senderId: BigInt(actor.id),
        type: 'text',
        body: dto.body,
      },
      include: {
        sender: { select: { id: true, fullName: true, phone: true } },
        attachments: { include: { file: { select: { path: true, visibility: true } } } },
      },
    });

    await this.afterMessagePersisted(message, actor, request.id);
    return this.serializeMessage(message, actor);
  }

  /** 10.3.3 — Send an image/file message (multipart). */
  async sendFile(
    requestId: string,
    actor: ActorInfo,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    caption?: string,
  ) {
    const { room, request } = await this.resolveRoom(requestId, actor);

    const major = (file.mimetype.split('/')[0] ?? '').toLowerCase();
    const messageType = MESSAGE_FILE_TYPES[major] ?? 'file';

    // 1) Persist the file via FilesService (storage + FileUpload record + hash)
    const uploaded = await this.files.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      actor.id,
      'private',
    );

    // 2) Create the message + attachment referencing the stored file
    const message = await this.prisma.message.create({
      data: {
        roomId: room.id,
        senderId: BigInt(actor.id),
        type: messageType,
        body: caption?.trim() || null,
        attachments: {
          create: {
            fileId: BigInt(uploaded.id),
            fileName: uploaded.originalName.slice(0, 255),
            fileSize: BigInt(file.size),
            mimeType: file.mimetype,
          },
        },
      },
    });

    const full = await this.prisma.message.findUnique({
      where: { id: message.id },
      include: {
        sender: { select: { id: true, fullName: true, phone: true } },
        attachments: { include: { file: { select: { path: true, visibility: true } } } },
      },
    });
    if (!full) throw new NotFoundException('پیام یافت نشد');

    await this.afterMessagePersisted(full, actor, request.id);
    return this.serializeMessage(full, actor);
  }

  /** 10.3.4 + 10.4.2 — Mark incoming messages as read (optionally up to one). */
  async markRead(requestId: string, actor: ActorInfo, dto: { messageId?: string }) {
    const { room } = await this.resolveRoom(requestId, actor);
    const now = new Date();

    const where = {
      roomId: room.id,
      senderId: { not: BigInt(actor.id) },
      readAt: null,
      deletedAt: null,
      ...(dto.messageId ? { id: { lte: this.toId(dto.messageId) } } : {}),
    };

    const updated = await this.prisma.message.updateMany({
      where,
      data: { readAt: now },
    });

    await this.prisma.chatParticipant.updateMany({
      where: { roomId: room.id, userId: BigInt(actor.id) },
      data: { lastReadAt: now },
    });

    if (updated.count > 0) {
      // Notify the other party (their ✓ → ✓✓)
      const lastRead = dto.messageId
        ? this.toId(dto.messageId)
        : (
            await this.prisma.message.findFirst({
              where: { roomId: room.id, senderId: { not: BigInt(actor.id) } },
              orderBy: { id: 'desc' },
              select: { id: true },
            })
          )?.id;

      await this.realtime.notifyMessageRead(requestId, {
        requestId,
        readerId: actor.id,
        lastMessageId: lastRead ? lastRead.toString() : null,
        readAt: now.toISOString(),
        count: updated.count,
      });
      await this.events.emit('message.read', {
        requestId,
        roomId: room.id.toString(),
        readerId: actor.id,
        count: updated.count,
      });
    }

    return { markedCount: updated.count };
  }

  /** 10.3.5 — Soft delete own message (admin can delete any). */
  async deleteMessage(requestId: string, messageId: string, actor: ActorInfo) {
    const { room } = await this.resolveRoom(requestId, actor);
    const id = this.toId(messageId);

    const message = await this.prisma.message.findFirst({
      where: { id, roomId: room.id, deletedAt: null },
    });
    if (!message) throw new NotFoundException('پیام یافت نشد');

    if (message.senderId.toString() !== actor.id && !actor.roles.includes('admin')) {
      throw new ForbiddenException('فقط فرستنده می‌تواند پیام را حذف کند');
    }

    const deletedAt = new Date();
    await this.prisma.message.update({
      where: { id },
      data: { deletedAt, deletedBy: BigInt(actor.id) },
    });

    await this.realtime.broadcastMessage(requestId, {
      event: 'MessageDeleted',
      requestId,
      messageId: id.toString(),
      deletedAt: deletedAt.toISOString(),
    });
    await this.events.emit('message.deleted', {
      requestId,
      messageId: id.toString(),
      actorId: actor.id,
    });

    return { message: 'پیام حذف شد' };
  }

  /** Total unread messages across all rooms of the user (badge helper). */
  async unreadCount(actor: ActorInfo) {
    const roomWhere = actor.roles.includes('admin')
      ? {}
      : actor.roles.includes('operator')
        ? { request: { assignedOperatorId: BigInt(actor.id) } }
        : { request: { customerId: BigInt(actor.id) } };

    const count = await this.prisma.message.count({
      where: {
        room: roomWhere,
        senderId: { not: BigInt(actor.id) },
        readAt: null,
        deletedAt: null,
      },
    });
    return { count };
  }

  // ==================== INTERNALS ====================

  /** Broadcast MessageSent + recipient notification after a message lands. */
  private async afterMessagePersisted(message: DbMessage, actor: ActorInfo, requestId: bigint) {
    const serialized = await this.serializeMessage(message, actor);

    // 10.4.1 — live broadcast to the room
    await this.realtime.broadcastMessage(requestId.toString(), serialized);
    await this.events.emit('message.sent', {
      requestId: requestId.toString(),
      messageId: message.id.toString(),
      senderId: actor.id,
      type: message.type,
    });

    // 10.4.5 + Phase 11.5.5 — persisted notification for the other party.
    // Recipient = the room participant(s) other than the sender.
    const participants = await this.prisma.chatParticipant.findMany({
      where: { roomId: message.roomId, userId: { not: BigInt(actor.id) } },
      select: { userId: true },
    });
    const preview =
      message.type === 'text'
        ? (message.body ?? '').slice(0, 80)
        : message.type === 'image'
          ? 'تصویر ارسال کرد'
          : 'فایل ارسال کرد';

    // NotificationService handles persistence, the private-user.{id} realtime
    // bell, Web Push and preference gating per recipient.
    await Promise.all(
      participants.map((p) =>
        this.notifications
          .send(p.userId.toString(), 'new_chat_message', {
            requestId: requestId.toString(),
            senderId: actor.id,
            body: preview,
          })
          .catch(() => undefined),
      ),
    );

    // Keep the room's updatedAt fresh for the rooms list ordering
    await this.prisma.chatRoom
      .update({ where: { id: message.roomId }, data: { updatedAt: new Date() } })
      .catch(() => undefined);

    return serialized;
  }

  private async serializeMessage(m: DbMessage, actor: ActorInfo): Promise<Record<string, unknown>> {
    const attachments: Array<Record<string, unknown>> = [];
    for (const a of m.attachments ?? []) {
      let url: string | null = null;
      try {
        if (a.file?.path && a.file.visibility === 'public') {
          url = this.storage.getPublicUrl(a.file.path);
        } else if (a.file?.path) {
          url = await this.storage.getSignedUrl(a.file.path, 3600);
        }
      } catch {
        url = null;
      }
      attachments.push({
        id: a.id.toString(),
        fileId: a.fileId.toString(),
        fileName: a.fileName,
        fileSize: Number(a.fileSize),
        mimeType: a.mimeType,
        url,
      });
    }

    return {
      id: m.id.toString(),
      uuid: m.uuid,
      roomId: m.roomId.toString(),
      senderId: m.senderId.toString(),
      sender: m.sender
        ? {
            id: m.sender.id.toString(),
            fullName: m.sender.fullName ?? null,
            phone: m.sender.phone,
          }
        : null,
      isMine: m.senderId.toString() === actor.id,
      type: m.type,
      body: m.deletedAt ? null : m.body,
      metadata: m.metadata ?? null,
      attachments,
      readAt: m.readAt,
      deletedAt: m.deletedAt,
      createdAt: m.createdAt,
    };
  }

  private toId(id: string): bigint {
    if (!/^\d+$/.test(id)) throw new BadRequestException('شناسه نامعتبر است');
    return BigInt(id);
  }

  private encodeCursor(id: bigint): string {
    return Buffer.from(`id:${id.toString()}`, 'utf8').toString('base64');
  }

  private decodeCursor(cursor: string): bigint {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const m = decoded.match(/^id:(\d+)$/);
      if (m) return BigInt(m[1]!);
    } catch {
      // fall through
    }
    throw new BadRequestException('کرسر صفحه‌بندی نامعتبر است');
  }
}
