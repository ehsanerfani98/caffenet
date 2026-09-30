/**
 * Notification preferences (Phase 11.1.2 / 11.3.6).
 *
 * Storage shape (NotificationPreference.preferences JSON):
 *   {
 *     "_push": boolean,                    // master Web Push switch
 *     "<notification_type>": {             // NotificationType value
 *       "inApp": boolean,
 *       "push": boolean,
 *       "email": boolean,
 *       "sms": boolean
 *     },
 *     ...
 *   }
 *
 * Missing rows / missing keys fall back to defaults:
 *   inApp: true, push: true, email: false, sms: false (sms true for critical
 *   types once explicitly enabled by the user or admin).
 *
 * The client-facing API aggregates per-type flags into groups
 * (requests / wallet / messages / marketing — see NOTIFICATION_GROUPS in
 * @caffenet/shared) so the mobile UI can show 5 simple toggles.
 */

import {
  NOTIFICATION_GROUPS,
  NotificationType,
  type NotificationGroupName,
} from '@caffenet/shared';

export interface PerTypeFlags {
  inApp: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
}

/** Raw JSON stored in NotificationPreference.preferences */
export interface StoredPrefs {
  _push?: boolean;
  [type: string]: Partial<PerTypeFlags> | boolean | undefined;
}

export const DEFAULT_TYPE_FLAGS: PerTypeFlags = {
  inApp: true,
  push: true,
  email: false,
  sms: false,
};

export const DEFAULT_PUSH_ENABLED = true;

/** Normalize a stored per-type entry into complete flags. */
export function resolveTypeFlags(
  stored: StoredPrefs | null | undefined,
  type: string,
): PerTypeFlags {
  const raw = stored?.[type];
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_TYPE_FLAGS };
  return {
    inApp: raw.inApp ?? DEFAULT_TYPE_FLAGS.inApp,
    push: raw.push ?? DEFAULT_TYPE_FLAGS.push,
    email: raw.email ?? DEFAULT_TYPE_FLAGS.email,
    sms: raw.sms ?? DEFAULT_TYPE_FLAGS.sms,
  };
}

/** Master Web Push switch — subscriptions are only used when this is on. */
export function resolvePushEnabled(stored: StoredPrefs | null | undefined): boolean {
  if (stored && typeof stored._push === 'boolean') return stored._push;
  return DEFAULT_PUSH_ENABLED;
}

/** Client-facing group view: one flag-set per group + push master switch. */
export interface GroupPrefsView {
  requests: PerTypeFlags;
  wallet: PerTypeFlags;
  messages: PerTypeFlags;
  marketing: PerTypeFlags;
  pushEnabled: boolean;
}

/** Expand stored per-type prefs into the grouped client view. */
export function toGroupView(stored: StoredPrefs | null | undefined): GroupPrefsView {
  const groupFor = (name: NotificationGroupName): PerTypeFlags => {
    const types = NOTIFICATION_GROUPS[name];
    const flags = types.map((t) => resolveTypeFlags(stored, t));
    // A group is on when ANY of its types is on (matches the single-toggle UX)
    return {
      inApp: flags.some((f) => f.inApp),
      push: flags.some((f) => f.push),
      email: flags.some((f) => f.email),
      sms: flags.some((f) => f.sms),
    };
  };
  return {
    requests: groupFor('requests'),
    wallet: groupFor('wallet'),
    messages: groupFor('messages'),
    marketing: groupFor('marketing'),
    pushEnabled: resolvePushEnabled(stored),
  };
}

/**
 * Merge a partial group view into the stored per-type JSON.
 * Group-level toggles are applied to every type in that group.
 * Returns the new StoredPrefs object (does not mutate input).
 */
export function applyGroupUpdate(
  stored: StoredPrefs | null | undefined,
  update: { [G in NotificationGroupName]?: Partial<PerTypeFlags> } & { pushEnabled?: boolean },
): StoredPrefs {
  const next: StoredPrefs = { ...(stored ?? {}) };

  if (typeof update.pushEnabled === 'boolean') {
    next._push = update.pushEnabled;
  }

  const groups: NotificationGroupName[] = ['requests', 'wallet', 'messages', 'marketing'];
  for (const group of groups) {
    const patch = update[group];
    if (!patch) continue;
    for (const type of NOTIFICATION_GROUPS[group]) {
      const current = resolveTypeFlags(next as StoredPrefs, type);
      next[type] = {
        inApp: patch.inApp ?? current.inApp,
        push: patch.push ?? current.push,
        email: patch.email ?? current.email,
        sms: patch.sms ?? current.sms,
      };
    }
  }
  return next;
}

/** All known notification type values (for validation / iteration). */
export const ALL_NOTIFICATION_TYPES: readonly string[] = Object.values(NotificationType);
