import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

/**
 * SettingsService — database-backed runtime configuration (Phase 12 pre-req).
 *
 * All operational values that were previously env-only (Pusher, Web Push /
 * VAPID, SMTP mail, SMS provider, payment gateways, PWA presentation …) are
 * now managed in the admin "site settings" UI and persisted in the
 * `system_settings` table. This service is the single read-side accessor:
 *
 *   1. DB value wins (admin-entered via GET/PUT /admin/settings)
 *   2. env var fallback (same keys as .env.example) for zero-config boots
 *   3. optional hard default
 *
 * Reads are cached in-process for a short TTL so hot paths (every realtime
 * trigger / push dispatch / gateway call) never hammer MySQL. Admin saves
 * call invalidate() on the API process; other processes (worker) pick the
 * change up within the TTL.
 */

/** env var used as fallback for a settings key when the DB row is absent. */
const ENV_FALLBACK: Record<string, string> = {
  'app.url': 'APP_URL',
  'app.frontend_url': 'FRONTEND_URL',
  'pusher.app_id': 'PUSHER_APP_ID',
  'pusher.key': 'PUSHER_KEY',
  'pusher.secret': 'PUSHER_SECRET',
  'pusher.cluster': 'PUSHER_CLUSTER',
  'push.vapid_public_key': 'VAPID_PUBLIC_KEY',
  'push.vapid_private_key': 'VAPID_PRIVATE_KEY',
  'push.vapid_subject': 'VAPID_SUBJECT',
  'mail.host': 'MAIL_HOST',
  'mail.port': 'MAIL_PORT',
  'mail.user': 'MAIL_USER',
  'mail.pass': 'MAIL_PASS',
  'mail.from': 'MAIL_FROM',
  'sms.provider': 'SMS_DRIVER',
  'sms.ipanel_api_key': 'IPANEL_API_KEY',
  'sms.ipanel_sender': 'IPANEL_SENDER',
  'sms.ipanel_otp_pattern_code': 'IPANEL_OTP_PATTERN_CODE',
  'sms.ipanel_otp_param_name': 'IPANEL_OTP_PARAM_NAME',
  'payments.zarinpal_merchant_id': 'ZARINPAL_MERCHANT_ID',
  'payments.zarinpal_sandbox': 'ZARINPAL_SANDBOX',
  'payments.zibal_merchant_id': 'ZIBAL_MERCHANT_ID',
  'payments.zibal_sandbox': 'ZIBAL_SANDBOX',
};

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  expiresAt: number;
  rows: Map<string, string>; // raw string values (value column)
}

@Injectable()
export class SettingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettingsService.name);
  private cache: CacheEntry | null = null;
  private loading: Promise<void> | null = null;
  private warmTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    // Warm eagerly so the first realtime/push/gateway call is already fast.
    void this.refresh();
    // Keep the cache reasonably fresh for long-lived processes (worker).
    this.warmTimer = setInterval(() => void this.refresh(), CACHE_TTL_MS);
    this.warmTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.warmTimer) clearInterval(this.warmTimer);
  }

  /** Drop the cache — called after admin settings updates. */
  invalidate(): void {
    this.cache = null;
  }

  /** Force a re-read of all settings rows (background-safe). */
  private async refresh(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const rows = await this.prisma.systemSetting.findMany({
          select: { key: true, value: true },
        });
        const map = new Map<string, string>();
        for (const r of rows) {
          if (r.value !== null && r.value !== undefined) map.set(r.key, r.value);
        }
        this.cache = { expiresAt: Date.now() + CACHE_TTL_MS, rows: map };
      } catch (err) {
        // Never crash callers (e.g. during migrate) — fall back to env only.
        this.logger.warn(
          `Settings load failed — env fallback in effect: ${err instanceof Error ? err.message : err}`,
        );
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  private async rows(): Promise<Map<string, string>> {
    if (!this.cache || this.cache.expiresAt < Date.now()) {
      await this.refresh();
    }
    return this.cache?.rows ?? new Map();
  }

  /** Raw string value: DB → env fallback → default. */
  async get(key: string, defaultValue?: string): Promise<string | undefined> {
    const map = await this.rows();
    const dbValue = map.get(key);
    if (dbValue !== undefined && dbValue !== '') return dbValue;

    const envKey = ENV_FALLBACK[key];
    if (envKey) {
      const envValue = this.config.get<string>(envKey);
      if (envValue !== undefined && envValue !== '') return envValue;
    }
    return defaultValue;
  }

  async getNumber(key: string, defaultValue?: number): Promise<number | undefined> {
    const raw = await this.get(key);
    if (raw === undefined || raw === '') return defaultValue;
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  }

  async getBoolean(key: string, defaultValue?: boolean): Promise<boolean | undefined> {
    const raw = await this.get(key);
    if (raw === undefined || raw === '') return defaultValue;
    return raw === 'true' || raw === '1';
  }

  // ==========================================================================
  // Typed accessors — the runtime consumers (Pusher, push, mail, sms, payments)
  // ==========================================================================

  async getPusherConfig(): Promise<{
    appId: string;
    key: string;
    secret: string;
    cluster: string;
    enabled: boolean;
  }> {
    const [appId, key, secret, cluster, enabled] = await Promise.all([
      this.get('pusher.app_id', ''),
      this.get('pusher.key', ''),
      this.get('pusher.secret', ''),
      this.get('pusher.cluster', 'mt1'),
      this.getBoolean('pusher.enabled', true),
    ]);
    return {
      appId: appId ?? '',
      key: key ?? '',
      secret: secret ?? '',
      cluster: cluster ?? 'mt1',
      enabled: enabled ?? true,
    };
  }

  async getVapidConfig(): Promise<{ publicKey: string; privateKey: string; subject: string }> {
    const [publicKey, privateKey, subject, appUrl] = await Promise.all([
      this.get('push.vapid_public_key', ''),
      this.get('push.vapid_private_key', ''),
      this.get('push.vapid_subject', ''),
      this.get('app.url', 'mailto:support@caffenet.local'),
    ]);
    return {
      publicKey: publicKey ?? '',
      privateKey: privateKey ?? '',
      subject: subject || appUrl || 'mailto:support@caffenet.local',
    };
  }

  async getMailConfig(): Promise<{
    enabled: boolean;
    driver: 'console' | 'smtp';
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  }> {
    const [enabled, driver, host, port, user, pass, from] = await Promise.all([
      this.getBoolean('mail.enabled', false),
      this.get('mail.driver', 'console'),
      this.get('mail.host', ''),
      this.getNumber('mail.port', 587),
      this.get('mail.user', ''),
      this.get('mail.pass', ''),
      this.get('mail.from', ''),
    ]);
    return {
      enabled: enabled ?? false,
      driver: driver === 'smtp' ? 'smtp' : 'console',
      host: host ?? '',
      port: port ?? 587,
      user: user ?? '',
      pass: pass ?? '',
      from: from ?? 'noreply@caffenet.local',
    };
  }

  async getSmsConfig(): Promise<{
    provider: 'ipanel' | 'kavenegar' | 'console';
    ipanelApiKey: string;
    ipanelSender: string;
    ipanelOtpPatternCode?: string;
    ipanelOtpParamName: string;
  }> {
    const [provider, apiKey, sender, pattern, paramName] = await Promise.all([
      this.get('sms.provider', 'ipanel'),
      this.get('sms.ipanel_api_key', ''),
      this.get('sms.ipanel_sender', ''),
      this.get('sms.ipanel_otp_pattern_code'),
      this.get('sms.ipanel_otp_param_name', 'code'),
    ]);
    const p = provider === 'kavenegar' || provider === 'console' ? provider : 'ipanel';
    return {
      provider: p,
      ipanelApiKey: apiKey ?? '',
      ipanelSender: sender ?? '',
      ipanelOtpPatternCode: pattern,
      ipanelOtpParamName: paramName ?? 'code',
    };
  }

  async getZarinpalConfig(): Promise<{ merchantId: string; sandbox: boolean }> {
    const [merchantId, sandbox] = await Promise.all([
      this.get('payments.zarinpal_merchant_id', ''),
      this.getBoolean('payments.zarinpal_sandbox', true),
    ]);
    return { merchantId: merchantId ?? '', sandbox: sandbox ?? true };
  }

  async getZibalConfig(): Promise<{ merchantId: string; sandbox: boolean }> {
    const [merchantId, sandbox] = await Promise.all([
      this.get('payments.zibal_merchant_id', 'zibal'),
      this.getBoolean('payments.zibal_sandbox', true),
    ]);
    return { merchantId: merchantId ?? 'zibal', sandbox: sandbox ?? true };
  }

  // ==========================================================================
  // Public (unauthenticated) presentation settings — consumed by the web app
  // for the PWA manifest and the pusher-js client.
  // ==========================================================================

  async getPublicSettings() {
    const [
      systemName,
      systemNameFa,
      systemDescription,
      appName,
      shortName,
      themeColor,
      backgroundColor,
      icon192,
      icon512,
      pusher,
      pushEnabled,
    ] = await Promise.all([
      this.get('system.name', 'Caffenet'),
      this.get('system.name_fa', 'کافی‌نت'),
      this.get('system.description', ''),
      this.get('pwa.app_name', 'کافی‌نت — سامانه خدمات آنلاین'),
      this.get('pwa.short_name', 'کافی‌نت'),
      this.get('pwa.theme_color', '#16a34a'),
      this.get('pwa.background_color', '#ffffff'),
      this.get('pwa.icon_192', '/icons/icon-192.png'),
      this.get('pwa.icon_512', '/icons/icon-512.png'),
      this.getPusherConfig(),
      this.getBoolean('push.enabled', true),
    ]);
    return {
      system: {
        name: systemName ?? 'Caffenet',
        nameFa: systemNameFa ?? 'کافی‌نت',
        description: systemDescription ?? '',
      },
      pwa: {
        name: appName ?? 'Caffenet',
        shortName: shortName ?? 'Caffenet',
        themeColor: themeColor ?? '#16a34a',
        backgroundColor: backgroundColor ?? '#ffffff',
        icon192: icon192 ?? '/icons/icon-192.png',
        icon512: icon512 ?? '/icons/icon-512.png',
      },
      // pusher.key is PUBLIC by design (browser SDK); secret is never exposed.
      pusher: {
        enabled: pusher.enabled && !!pusher.key,
        key: pusher.key,
        cluster: pusher.cluster,
      },
      push: { enabled: pushEnabled ?? true },
    };
  }
}
