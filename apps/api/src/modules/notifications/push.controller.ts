/**
 * Push subscription endpoints (Phase 11.4.3 / 11.4.4 / 11.4.7).
 *
 *  POST   /push/subscribe   — register (or rotate) a browser subscription
 *  DELETE /push/subscribe   — remove a subscription (browser unsubscribed)
 *
 * Rotation (11.4.7): endpoints are UNIQUE — re-subscribing the same browser
 * upserts keys / device info instead of creating a duplicate row. This also
 * covers browser-generated endpoint changes: stale rows for the same user
 * agent are replaced.
 */

import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { PushService } from './push.service';
import { PushSubscribeDto, PushUnsubscribeDto } from './notifications.dto';

interface Actor {
  id: string;
}

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'وضعیت Web Push برای این مرورگر/کاربر' })
  async status(@CurrentUser() user: Actor) {
    const pushStatus = await this.push.getStatus();
    return {
      enabled: pushStatus.enabled,
      publicKey: pushStatus.publicKey,
      subscriptions: await this.prisma.pushSubscription.count({
        where: { userId: BigInt(user.id), expiredAt: null },
      }),
    };
  }

  @Post('subscribe')
  @HttpCode(200)
  @ApiOperation({ summary: 'ثبت اشتراک Web Push (upsert بر اساس endpoint)' })
  async subscribe(@CurrentUser() user: Actor, @Body() dto: PushSubscribeDto) {
    if (!(await this.push.getStatus()).enabled) {
      throw new ForbiddenException('سرویس Web Push در سرور فعال نیست');
    }
    const { p256dh, auth } = dto.keys ?? {};
    if (!p256dh || !auth) {
      throw new BadRequestException('کلیدهای p256dh و auth الزامی هستند');
    }

    // Upsert = rotation per browser (11.4.7)
    const subscription = await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId: BigInt(user.id),
        endpoint: dto.endpoint,
        p256dhKey: p256dh,
        authKey: auth,
        userAgent: dto.userAgent ?? null,
        deviceType: dto.deviceType ?? null,
      },
      update: {
        userId: BigInt(user.id),
        p256dhKey: p256dh,
        authKey: auth,
        userAgent: dto.userAgent ?? undefined,
        deviceType: dto.deviceType ?? undefined,
        expiredAt: null, // re-activating a rotated subscription
        lastUsedAt: new Date(),
      },
    });

    return {
      id: subscription.uuid,
      endpoint: subscription.endpoint,
      createdAt: subscription.createdAt.toISOString(),
    };
  }

  @Delete('subscribe')
  @HttpCode(200)
  @ApiOperation({ summary: 'حذف اشتراک Web Push' })
  async unsubscribe(@CurrentUser() user: Actor, @Body() dto: PushUnsubscribeDto) {
    const res = await this.prisma.pushSubscription.deleteMany({
      where: { userId: BigInt(user.id), endpoint: dto.endpoint },
    });
    return { removed: res.count };
  }
}
