import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsService } from './settings.service';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../database/prisma.service';

/**
 * SettingsService unit tests (Phase 12 pre-req):
 *   DB value wins → env fallback → default.
 *   invalidate() forces re-read; typed accessors shape their configs.
 */

function makePrisma(rows: Array<{ key: string; value: string | null }>): PrismaService {
  return {
    systemSetting: {
      findMany: vi.fn().mockResolvedValue(rows),
    },
  } as unknown as PrismaService;
}

function makeConfig(env: Record<string, string>): ConfigService {
  return {
    get: vi.fn((key: string) => env[key]),
  } as unknown as ConfigService;
}

describe('SettingsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers DB value over env', async () => {
    const svc = new SettingsService(
      makePrisma([{ key: 'pusher.cluster', value: 'eu' }]),
      makeConfig({ PUSHER_CLUSTER: 'mt1' }),
    );
    await expect(svc.get('pusher.cluster')).resolves.toBe('eu');
  });

  it('falls back to env when the DB row is absent', async () => {
    const svc = new SettingsService(makePrisma([]), makeConfig({ PUSHER_CLUSTER: 'ap1' }));
    await expect(svc.get('pusher.cluster')).resolves.toBe('ap1');
  });

  it('falls back to env when the DB row is empty string', async () => {
    const svc = new SettingsService(
      makePrisma([{ key: 'sms.ipanel_api_key', value: '' }]),
      makeConfig({ IPANEL_API_KEY: 'env-key' }),
    );
    await expect(svc.get('sms.ipanel_api_key')).resolves.toBe('env-key');
  });

  it('returns the default when neither DB nor env has a value', async () => {
    const svc = new SettingsService(makePrisma([]), makeConfig({}));
    await expect(svc.get('pwa.theme_color', '#16a34a')).resolves.toBe('#16a34a');
    await expect(svc.get('pusher.app_id')).resolves.toBeUndefined();
  });

  it('ignores env when the key has no env mapping', async () => {
    const svc = new SettingsService(makePrisma([]), makeConfig({ PWA_THEME_COLOR: 'red' }));
    await expect(svc.get('pwa.theme_color', 'green')).resolves.toBe('green');
  });

  it('getBoolean parses true/1, getNumber parses numerics', async () => {
    const svc = new SettingsService(
      makePrisma([
        { key: 'push.enabled', value: 'true' },
        { key: 'mail.port', value: '465' },
        { key: 'payments.zibal_sandbox', value: '0' },
      ]),
      makeConfig({}),
    );
    await expect(svc.getBoolean('push.enabled')).resolves.toBe(true);
    await expect(svc.getNumber('mail.port')).resolves.toBe(465);
    await expect(svc.getBoolean('payments.zibal_sandbox')).resolves.toBe(false);
  });

  it('invalidate() forces a fresh DB read', async () => {
    const prisma = makePrisma([{ key: 'pusher.key', value: 'key-1' }]);
    const svc = new SettingsService(prisma, makeConfig({}));
    await expect(svc.get('pusher.key')).resolves.toBe('key-1');

    (prisma.systemSetting.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'pusher.key', value: 'key-2' },
    ]);
    svc.invalidate();
    await expect(svc.get('pusher.key')).resolves.toBe('key-2');
  });

  it('getPusherConfig reports disabled when enabled=false in DB', async () => {
    const svc = new SettingsService(
      makePrisma([
        { key: 'pusher.app_id', value: '123' },
        { key: 'pusher.key', value: 'k' },
        { key: 'pusher.secret', value: 's' },
        { key: 'pusher.enabled', value: 'false' },
      ]),
      makeConfig({}),
    );
    const cfg = await svc.getPusherConfig();
    expect(cfg).toMatchObject({ appId: '123', key: 'k', secret: 's', enabled: false });
    expect(cfg.cluster).toBe('mt1'); // default
  });

  it('getVapidConfig uses app.url as subject fallback', async () => {
    const svc = new SettingsService(
      makePrisma([
        { key: 'push.vapid_public_key', value: 'PUB' },
        { key: 'push.vapid_private_key', value: 'PRIV' },
        { key: 'app.url', value: 'https://api.caffenet.ir' },
      ]),
      makeConfig({}),
    );
    const cfg = await svc.getVapidConfig();
    expect(cfg).toEqual({
      publicKey: 'PUB',
      privateKey: 'PRIV',
      subject: 'https://api.caffenet.ir',
    });
  });

  it('getPublicSettings never leaks pusher.secret', async () => {
    const svc = new SettingsService(
      makePrisma([
        { key: 'pusher.key', value: 'public-key' },
        { key: 'pusher.secret', value: 'top-secret' },
        { key: 'pwa.theme_color', value: '#0ea5e9' },
      ]),
      makeConfig({}),
    );
    const pub = await svc.getPublicSettings();
    expect(pub.pusher.key).toBe('public-key');
    expect(JSON.stringify(pub)).not.toContain('top-secret');
    expect(pub.pwa.themeColor).toBe('#0ea5e9');
  });

  it('getSmsConfig normalizes provider values', async () => {
    const svc = new SettingsService(
      makePrisma([{ key: 'sms.provider', value: 'whatever' }]),
      makeConfig({}),
    );
    const cfg = await svc.getSmsConfig();
    expect(cfg.provider).toBe('ipanel');
  });
});
