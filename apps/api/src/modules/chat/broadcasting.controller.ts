import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Request } from 'express';
import * as crypto from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RealtimeService } from '../../realtime/realtime.service';
import { PrismaService } from '../../database/prisma.service';
import { ActorInfo } from './chat.service';

export class BroadcastingAuthDto {
  @IsString()
  socket_id!: string;

  @IsString()
  channel_name!: string;
}

/**
 * Pusher channel authorization + webhooks (Phase 10.1.3 / 10.1.7).
 *
 * The web client subscribes via pusher-js with an authEndpoint pointing to
 * `POST /api/v1/broadcasting/auth`. The JWT identifies the user; channel
 * membership is re-checked here:
 *   - private-user.{userId}      → only that user
 *   - private-request.{id}       → customer(owner) / assigned operator / admin
 *   - presence-request.{id}      → same as above (with presence metadata)
 *   - private-admin              → admins only
 */
@ApiTags('broadcasting')
@Controller('broadcasting')
export class BroadcastingController {
  private readonly logger = new Logger(BroadcastingController.name);

  constructor(
    private readonly realtime: RealtimeService,
    private readonly prisma: PrismaService,
  ) {}

  /** 10.1.3 — signed channel authorization behind JWT auth. */
  @Post('auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'احراز اشتراک کانال Pusher (private/presence)' })
  async authorize(
    @Body() dto: BroadcastingAuthDto,
    @CurrentUser() user: ActorInfo & { fullName?: string | null; phone?: string },
  ) {
    const { socket_id: socketId, channel_name: channel } = dto;
    if (!socketId || !channel) {
      throw new BadRequestException('socket_id و channel_name الزامی است');
    }

    await this.assertChannelAccess(channel, user);

    // Ensure the DB-configured Pusher client is loaded before signing
    if (!(await this.realtime.ensureReady())) {
      throw new ForbiddenException('سرویس Real-time تنظیم نشده است');
    }

    const isPresence = channel.startsWith('presence-');
    const auth = this.realtime.authenticateChannel(
      socketId,
      channel,
      isPresence
        ? {
            user_id: user.id,
            user_info: {
              name: user.fullName ?? user.phone,
              roles: user.roles,
            },
          }
        : undefined,
    );

    return { auth };
  }

  /** 10.1.7 — Pusher webhook (channel_existence / occupancy). HMAC-verified. */
  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'وب‌هوک Pusher (channel_existence) با امضای HMAC' })
  async webhook(@Req() req: RawBodyRequest<Request>) {
    // Credentials come from DB settings (Admin → Settings → Pusher), env fallback
    const credentials = await this.realtime.getCredentials();
    const key = credentials?.key;
    const secret = credentials?.secret;

    const pusherKey = req.headers['x-pusher-key'] as string | undefined;
    const signature = req.headers['x-pusher-signature'] as string | undefined;
    const rawBody = (req.rawBody ?? Buffer.from('')).toString('utf8');

    if (!key || !secret) {
      // Pusher not configured — accept & ignore to avoid retry storms
      return { ok: true, ignored: true };
    }
    if (pusherKey !== key || !signature) {
      throw new ForbiddenException('وب‌هوک نامعتبر است');
    }

    const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(digest);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new ForbiddenException('امضای وب‌هوک نامعتبر است');
    }

    try {
      const payload = JSON.parse(rawBody) as {
        time_ms?: number;
        events?: Array<{ name: string; channel?: string }>;
      };
      for (const event of payload.events ?? []) {
        // channel_existence: occupied/vacated — useful for presence bookkeeping
        this.logger.debug(`Pusher webhook event=${event.name} channel=${event.channel ?? '-'}`);
      }
    } catch {
      // malformed body after a valid signature — log & accept
      this.logger.warn('Pusher webhook body parse failed');
    }

    return { ok: true };
  }

  /** Channel-level access rules (10.1.4–10.1.6). */
  private async assertChannelAccess(channel: string, user: ActorInfo) {
    if (channel === 'private-admin') {
      if (!user.roles.includes('admin')) {
        throw new ForbiddenException('دسترسی به این کانال فقط برای مدیران است');
      }
      return;
    }

    const requestMatch = channel.match(/^(?:private|presence)-request\.(\d+)$/);
    if (requestMatch) {
      const requestId = BigInt(requestMatch[1]!);
      const request = await this.prisma.request.findUnique({
        where: { id: requestId },
        select: { customerId: true, assignedOperatorId: true },
      });
      if (!request) throw new BadRequestException('درخواست یافت نشد');

      const allowed =
        user.roles.includes('admin') ||
        request.customerId.toString() === user.id ||
        (user.roles.includes('operator') && request.assignedOperatorId?.toString() === user.id);
      if (!allowed) {
        throw new ForbiddenException('دسترسی به کانال این درخواست را ندارید');
      }
      return;
    }

    const userMatch = channel.match(/^private-user\.(\d+)$/);
    if (userMatch) {
      if (userMatch[1]! !== user.id) {
        throw new ForbiddenException('کانال کاربری دیگر قابل اشتراک نیست');
      }
      return;
    }

    throw new BadRequestException('نام کانال پشتیبانی نمی‌شود');
  }
}
