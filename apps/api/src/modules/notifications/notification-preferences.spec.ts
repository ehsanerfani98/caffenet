import { describe, expect, it } from 'vitest';
import { NOTIFICATION_GROUPS } from '@caffenet/shared';
import {
  applyGroupUpdate,
  resolvePushEnabled,
  resolveTypeFlags,
  toGroupView,
  type StoredPrefs,
} from './notification-preferences';

describe('notification preferences (Phase 11.1.2 / 11.3.6)', () => {
  it('defaults to inApp+push on, email+sms off when no row exists', () => {
    const flags = resolveTypeFlags(null, 'request_status_changed');
    expect(flags).toEqual({ inApp: true, push: true, email: false, sms: false });
  });

  it('resolves stored per-type flags with fallbacks', () => {
    const stored: StoredPrefs = {
      request_status_changed: { inApp: true, push: false, email: true },
    };
    const flags = resolveTypeFlags(stored, 'request_status_changed');
    expect(flags.inApp).toBe(true);
    expect(flags.push).toBe(false);
    expect(flags.email).toBe(true);
    expect(flags.sms).toBe(false); // defaulted
  });

  it('push master switch defaults to enabled', () => {
    expect(resolvePushEnabled(null)).toBe(true);
    expect(resolvePushEnabled({ _push: false })).toBe(false);
  });

  it('group view aggregates per-type flags (any-on semantics)', () => {
    const stored: StoredPrefs = {
      request_status_changed: { inApp: false, push: false, email: false, sms: false },
      request_assigned: { inApp: true, push: true, email: false, sms: false },
    };
    const view = toGroupView(stored);
    expect(view.requests.inApp).toBe(true); // request_assigned still on
    expect(view.messages.inApp).toBe(true); // default on
    expect(view.pushEnabled).toBe(true);
  });

  it('applies group update to every type in the group', () => {
    const next = applyGroupUpdate(null, {
      wallet: { inApp: false, push: false, email: false, sms: false },
    });
    for (const type of NOTIFICATION_GROUPS.wallet) {
      const flags = resolveTypeFlags(next, type);
      expect(flags.inApp).toBe(false);
      expect(flags.push).toBe(false);
    }
    // other groups untouched
    expect(resolveTypeFlags(next, 'request_assigned').inApp).toBe(true);
  });

  it('updates the push master switch', () => {
    const next = applyGroupUpdate(null, { pushEnabled: false });
    expect(resolvePushEnabled(next)).toBe(false);
  });

  it('merges onto existing prefs without losing unrelated types', () => {
    const existing: StoredPrefs = {
      new_chat_message: { inApp: true, push: true, email: true, sms: false },
    };
    const next = applyGroupUpdate(existing, { messages: { email: false } });
    const flags = resolveTypeFlags(next, 'new_chat_message');
    expect(flags.email).toBe(false);
    expect(flags.push).toBe(true);
    expect(flags.inApp).toBe(true);
  });
});
