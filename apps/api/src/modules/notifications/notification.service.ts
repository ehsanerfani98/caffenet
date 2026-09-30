/**
 * NotificationService (Phase 11.2) — single entry point for all in-app,
 * real-time, Web Push, email and SMS notifications.
 *
 * send(userId, type, data):
 *   1. Resolve the user + their per-type channel preferences (11.2.1)
 *   2. Render localized title/body from templates (11.2.2)
 *   3. Persist the in-app notification row (11.2.3)
 *   4. Emit `NotificationCreated` on private-user.{id} (11.2.4)
 *   5. Enqueue one send_web_push job per active subscription (11.2.5)
 *   6. Enqueue send_email when the channel is enabled (11.2.6)
 *   7. Enqueue send_sms for critical types when enabled (11.2.7)
 *
 * Fan-out helpers: sendToUsers / sendToRole (operators, admins — 11.5.1, 11.5.6).
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { QUEUE_TOKEN } from '../../queue/interfaces/queue.interface';
import type { IQueue } from '../../queue/interfaces/queue.interface';
import { Inject } from '@nestjs/common';
import { JobName, NotificationType } from '@caffenet/shared';
import {
  renderNotification,
  SMS_CRITICAL_TYPES,
  type TemplateData,
} from './notification-templates';
import { resolvePushEnabled, resolveTypeFlags, type StoredPrefs } from './notification-preferences';

export interface NotificationDto {
  id: string;
  uuid: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

/** Extra switches for programmatic sends (event listeners / broadcasts). */
export interface SendOptions {
  /** Override channel prefs entirely (admin broadcast / system notices). */
  forceInApp?: boolean;
  /** Skip the real-time channel (e.g. when the caller already emitted it). */
  skipRealtime?: boolean;
  /** Skip push/email/sms dispatch — in-app + realtime only. */
  inAppOnly?: boolean;
  /** Use these title/body verbatim instead of template rendering (queue jobs). */
  override?: { title: string; body: string | null; link?: string | null };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    @Inject(QUEUE_TOKEN) private readonly queue: IQueue,
  ) {}

  // ==========================================================================
  // Core send (11.2.1 – 11.2.7)
  // ==========================================================================

  /** Send a typed notification to one user. Returns the in-app row (if persisted). */
  async send(
    userId: string,
    type: string,
    data: TemplateData = {},
    opts: SendOptions = {},
  ): Promise<NotificationDto | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { id: true, phone: true, email: true, preferredLocale: true, deletedAt: true },
      });
      if (!user || user.deletedAt) return null;

      const stored = await this.loadStoredPrefs(userId);
      const flags = resolveTypeFlags(stored, type);
      const pushEnabled = resolvePushEnabled(stored);

      // Localized copy (11.2.2) — or verbatim override from queue jobs
      const rendered = opts.override
        ? { title: opts.override.title, body: opts.override.body, link: opts.override.link ?? null }
        : renderNotification(type, data, user.preferredLocale || 'fa');
      const persistData = { ...data, link: data.link ?? rendered.link ?? undefined };

      // In-app persistence (11.2.3)
      let row: NotificationDto | null = null;
      if (opts.forceInApp || flags.inApp) {
        const created = await this.prisma.notification.create({
          data: {
            userId: BigInt(userId),
            type,
            title: rendered.title,
            body: rendered.body,
            data: persistData as unknown as Prisma.InputJsonValue,
          },
        });
        row = this.serialize(created);
      }

      // Real-time bell (11.2.4)
      if (!opts.skipRealtime && (row || flags.push)) {
        await this.realtime
          .notifyUser(userId, 'NotificationCreated', {
            id: row?.uuid ?? null,
            type,
            title: rendered.title,
            body: rendered.body,
            data: persistData,
            createdAt: row?.createdAt ?? new Date().toISOString(),
          })
          .catch(() => undefined);
      }

      if (opts.inAppOnly) return row;

      // Web Push (11.2.5) — enqueue one job per active subscription
      if (flags.push && pushEnabled) {
        const subs = await this.prisma.pushSubscription.findMany({
          where: { userId: BigInt(userId), expiredAt: null },
          select: { uuid: true },
        });
        for (const sub of subs) {
          await this.queue
            .enqueue(JobName.SEND_WEB_PUSH, {
              subscriptionId: sub.uuid,
              payload: {
                title: rendered.title,
                body: rendered.body ?? rendered.title,
                data: persistData,
                tag: type,
              },
            })
            .catch((e: unknown) =>
              this.logger.warn(`Failed to enqueue web push: ${e instanceof Error ? e.message : e}`),
            );
        }
      }

      // Email (11.2.6)
      if (flags.email && user.email) {
        await this.queue
          .enqueue(JobName.SEND_EMAIL, {
            to: user.email,
            subject: rendered.title,
            body: rendered.body ?? rendered.title,
            isHtml: false,
          })
          .catch(() => undefined);
      }

      // SMS — critical types only (11.2.7)
      if (flags.sms && SMS_CRITICAL_TYPES.has(type) && user.phone) {
        await this.queue
          .enqueue(JobName.SEND_SMS, {
            phone: user.phone,
            message: rendered.body ? `${rendered.title}\n${rendered.body}` : rendered.title,
          })
          .catch(() => undefined);
      }

      return row;
    } catch (err) {
      // Notifications must never break the triggering flow
      this.logger.error(
        `Notification send failed (user=${userId}, type=${type}): ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /** Send the same typed notification to many users (sequential, fault-tolerant). */
  async sendToUsers(
    userIds: Array<string | number | bigint>,
    type: string,
    data: TemplateData = {},
    opts: SendOptions = {},
  ): Promise<void> {
    for (const id of userIds) {
      await this.send(id.toString(), type, data, opts);
    }
  }

  /** Fan-out to every active user holding a role (operators / admins — 11.5). */
  async sendToRole(
    role: 'operator' | 'admin',
    type: string,
    data: TemplateData = {},
    opts: SendOptions = {},
  ): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        roles: { some: { role: { name: role } } },
      },
      select: { id: true },
      take: 5000,
    });
    await this.sendToUsers(
      users.map((u) => u.id),
      type,
      data,
      opts,
    );
  }

  /**
   * Send a pre-rendered notification (title/body already resolved) — used by
   * the queue worker for send_notification jobs and admin broadcast fan-out.
   * Skips template rendering; channel dispatch identical to send().
   */
  async sendRaw(
    userId: string,
    content: { type: string; title: string; body?: string | null; data?: Record<string, unknown> },
    opts: SendOptions = {},
  ): Promise<NotificationDto | null> {
    return this.send(userId, content.type, content.data ?? {}, {
      ...opts,
      override: {
        title: content.title,
        body: content.body ?? null,
        link: (content.data?.link as string | undefined) ?? null,
      },
    });
  }

  // ==========================================================================
  // List / read / unread-count (11.3)
  // ==========================================================================
  async list(
    userId: string,
    params: { page?: number; limit?: number; unreadOnly?: boolean; type?: string },
  ): Promise<{
    items: NotificationDto[];
    meta: { page: number; limit: number; total: number; totalPages: number; unreadCount: number };
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const where: Record<string, unknown> = { userId: BigInt(userId) };
    if (params.unreadOnly) where.readAt = null;
    if (params.type) where.type = params.type;

    const [total, unreadCount, rows] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId: BigInt(userId), readAt: null } }),
      this.prisma.notification.findMany({
        where,
        // Unread first (11.3.1) — MySQL sorts NULL first in ASC — then newest
        orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((r) => this.serialize(r)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        unreadCount,
      },
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId: BigInt(userId), readAt: null } });
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationDto | null> {
    const existing = await this.resolveOwn(userId, notificationId);
    if (!existing) return null;
    if (existing.readAt) return this.serialize(existing);
    const updated = await this.prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: new Date() },
    });
    return this.serialize(updated);
  }

  async markAllRead(userId: string): Promise<number> {
    const res = await this.prisma.notification.updateMany({
      where: { userId: BigInt(userId), readAt: null },
      data: { readAt: new Date() },
    });
    return res.count;
  }

  async remove(userId: string, notificationId: string): Promise<boolean> {
    const existing = await this.resolveOwn(userId, notificationId);
    if (!existing) return false;
    await this.prisma.notification.delete({ where: { id: existing.id } });
    return true;
  }

  // ==========================================================================
  // Preferences (11.3.6)
  // ==========================================================================

  private async loadStoredPrefs(userId: string): Promise<StoredPrefs> {
    const row = await this.prisma.notificationPreference.findUnique({
      where: { userId: BigInt(userId) },
      select: { preferences: true },
    });
    return (row?.preferences ?? {}) as StoredPrefs;
  }

  /** Raw stored preferences JSON (for the PUT/GET endpoints). */
  async getStoredPrefs(userId: string): Promise<StoredPrefs> {
    return this.loadStoredPrefs(userId);
  }

  async saveStoredPrefs(userId: string, prefs: StoredPrefs): Promise<StoredPrefs> {
    await this.prisma.notificationPreference.upsert({
      where: { userId: BigInt(userId) },
      create: {
        userId: BigInt(userId),
        preferences: prefs as unknown as Prisma.InputJsonValue,
      },
      update: { preferences: prefs as unknown as Prisma.InputJsonValue },
    });
    return prefs;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /** Resolve a notification belonging to the user by numeric id or uuid. */
  private async resolveOwn(userId: string, notificationId: string) {
    const isNumeric = /^\d+$/.test(notificationId);
    return this.prisma.notification.findFirst({
      where: {
        userId: BigInt(userId),
        ...(isNumeric ? { id: BigInt(notificationId) } : { uuid: notificationId }),
      },
    });
  }

  private serialize(row: {
    id: bigint;
    uuid: string;
    type: string;
    title: string;
    body: string | null;
    data: unknown;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: row.id.toString(),
      uuid: row.uuid,
      type: row.type,
      title: row.title,
      body: row.body,
      data: (row.data ?? null) as Record<string, unknown> | null,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

// Re-export for controller typing convenience
export { NotificationType };
