/**
 * Queue job handlers (Phase 11) — dispatched by the worker CLI by JobName.
 *
 * Handles the notification pipeline jobs (TASKS.md 11.2 / 11.4):
 *   send_notification            → persist + realtime + push/email/sms fan-out
 *                                  (pre-rendered payloads, e.g. admin broadcast)
 *   send_web_push                → deliver one push; 410/404 deletes the
 *                                  subscription (11.4.6 expiry detection)
 *   send_email                   → MailService (console driver — Phase 11)
 *   send_sms                     → SmsGateway direct text
 *   cleanup_push_subscriptions   → purge expired / dead subscriptions
 *   cleanup_expired_otps         → purge consumed/expired OTPs
 *   cleanup_expired_sessions     → purge expired auth sessions
 *
 * The registry is built once per worker boot from DI services; the API
 * process itself never runs handlers (it only enqueues).
 */

import { Logger } from '@nestjs/common';
import { JobName } from '@caffenet/shared';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { PushService } from '../../modules/notifications/push.service';
import { NotificationService } from '../../modules/notifications/notification.service';
import { MailService } from '../../modules/mail/mail.service';
import { SMS_GATEWAY_TOKEN } from '../../modules/sms/sms.interface';
import type { SmsGateway } from '../../modules/sms/sms.interface';
import type { IJobPayload } from '../interfaces/queue.interface';

export type JobHandler<K extends JobName = JobName> = (payload: IJobPayload[K]) => Promise<void>;

export interface JobHandlerDeps {
  prisma: PrismaService;
  realtime: RealtimeService;
  push: PushService;
  notifications: NotificationService;
  mail: MailService;
  sms: SmsGateway;
}

export function createJobHandlers(deps: JobHandlerDeps): Record<JobName, JobHandler> {
  const logger = new Logger('JobHandlers');

  // ---- send_notification ----------------------------------------------------
  // Persist a pre-rendered notification + realtime + push/email/sms dispatch.
  const sendNotification: JobHandler<JobName.SEND_NOTIFICATION> = async (payload) => {
    await deps.notifications.sendRaw(payload.userId, {
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
  };

  // ---- send_web_push (11.4.5 + 11.4.6) ----------------------------------------
  const sendWebPush: JobHandler<JobName.SEND_WEB_PUSH> = async (payload) => {
    const sub = await deps.prisma.pushSubscription.findUnique({
      where: { uuid: payload.subscriptionId },
    });
    if (!sub) return; // already removed — nothing to do

    const outcome = await deps.push.sendToSubscription(
      { endpoint: sub.endpoint, p256dhKey: sub.p256dhKey, authKey: sub.authKey },
      payload.payload,
    );

    if (outcome === 'sent') {
      await deps.prisma.pushSubscription
        .update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
      return;
    }
    if (outcome === 'gone') {
      // 11.4.6 — subscription expired (410 Gone / 404) → remove it
      await deps.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
      logger.log(`Removed dead push subscription ${sub.uuid} (gone)`);
      return;
    }
    // 'failed' (transient) / 'disabled' → surface for queue retry bookkeeping
    throw new Error(
      outcome === 'disabled' ? 'Web Push disabled (VAPID missing)' : 'Push delivery failed',
    );
  };

  // ---- send_email -------------------------------------------------------------
  const sendEmail: JobHandler<JobName.SEND_EMAIL> = async (payload) => {
    const res = await deps.mail.send({
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      isHtml: payload.isHtml,
    });
    if (!res.success) throw new Error(res.error ?? 'Email send failed');
  };

  // ---- send_sms ---------------------------------------------------------------
  const sendSms: JobHandler<JobName.SEND_SMS> = async (payload) => {
    const res = payload.patternCode
      ? await deps.sms.sendOtpPattern(payload.phone, payload.params ?? {}, payload.patternCode)
      : await deps.sms.sendSms(payload.phone, payload.message);
    if (!res.success) throw new Error(res.error ?? 'SMS send failed');
  };

  // ---- cleanup_push_subscriptions (11.4.6 support) ------------------------------
  const cleanupPushSubscriptions: JobHandler<JobName.CLEANUP_PUSH_SUBSCRIPTIONS> = async () => {
    const now = new Date();
    const expired = await deps.prisma.pushSubscription.deleteMany({
      where: { expiredAt: { lte: now } },
    });
    // Subscriptions unused for 90 days are considered abandoned
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const stale = await deps.prisma.pushSubscription.deleteMany({
      where: { expiredAt: null, lastUsedAt: { lt: cutoff } },
    });
    logger.log(`cleanup_push_subscriptions: expired=${expired.count}, stale=${stale.count}`);
  };

  // ---- cleanup_expired_otps -----------------------------------------------------
  const cleanupExpiredOtps: JobHandler<JobName.CLEANUP_EXPIRED_OTPS> = async () => {
    const res = await deps.prisma.otp.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { status: 'consumed' }],
      },
    });
    logger.log(`cleanup_expired_otps: removed=${res.count}`);
  };

  // ---- cleanup_expired_sessions ---------------------------------------------------
  const cleanupExpiredSessions: JobHandler<JobName.CLEANUP_EXPIRED_SESSIONS> = async () => {
    const res = await deps.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    logger.log(`cleanup_expired_sessions: removed=${res.count}`);
  };

  return {
    [JobName.SEND_NOTIFICATION]: sendNotification,
    [JobName.SEND_WEB_PUSH]: sendWebPush,
    [JobName.SEND_EMAIL]: sendEmail,
    [JobName.SEND_SMS]: sendSms,
    [JobName.PAYMENT_RECONCILIATION]: async () => {
      // Phase 6 scope — handled by payments cron; kept as a safe no-op here.
      logger.warn('payment_reconciliation handler is a no-op in Phase 11');
    },
    [JobName.CLEANUP_PUSH_SUBSCRIPTIONS]: cleanupPushSubscriptions,
    [JobName.CLEANUP_EXPIRED_OTPS]: cleanupExpiredOtps,
    [JobName.CLEANUP_EXPIRED_SESSIONS]: cleanupExpiredSessions,
  } as Record<JobName, JobHandler>;
}

// Re-export so the worker can resolve realtime deps without leaking internals
export { RealtimeService };
