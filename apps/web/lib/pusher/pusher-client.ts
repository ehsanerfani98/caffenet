'use client';

import Pusher, { type Channel } from 'pusher-js';
import { PUSHER_CONFIG } from '@caffenet/shared';

const AUTH_ENDPOINT =
  process.env.NEXT_PUBLIC_PUSHER_AUTH_ENDPOINT ||
  `${process.env.NEXT_PUBLIC_API_URL}/broadcasting/auth`;

// Public credentials are DB-managed (Admin → Settings → Pusher) and served by
// `GET /settings/public`. Env (NEXT_PUBLIC_PUSHER_*) is the zero-config
// fallback. Module-level so a config fetch can upgrade them before client
// creation — the pusher key is PUBLIC by design.
let PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
let PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';
let publicConfigLoaded: Promise<void> | null = null;
let client: Pusher | null = null;

function currentAccessToken(): string {
  if (typeof window === 'undefined') return '';
  // auth-store mirrors the access token into localStorage (see lib/api-client)
  return window.localStorage.getItem('access_token') ?? '';
}

/**
 * Resolve PUBLIC Pusher credentials from the backend's public settings
 * (`GET /api/v1/settings/public`) once per session. Falls back to the
 * NEXT_PUBLIC_* env vars when the request fails.
 */
export function preloadPusherConfig(): Promise<void> {
  if (publicConfigLoaded) return publicConfigLoaded;
  publicConfigLoaded = (async () => {
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
      if (!apiBase) return;
      const res = await fetch(`${apiBase}/settings/public`, { cache: 'no-store' });
      if (!res.ok) return;
      const body = (await res.json()) as {
        pusher?: { enabled?: boolean; key?: string; cluster?: string };
      };
      if (body.pusher?.key) {
        PUSHER_KEY = body.pusher.key;
        PUSHER_CLUSTER = body.pusher.cluster || PUSHER_CLUSTER;
      } else {
        PUSHER_KEY = undefined; // disabled or unset server-side
      }
    } catch {
      // offline / API down → env fallback stays in effect
    }
  })();
  return publicConfigLoaded;
}

/**
 * Pusher-js singleton (Phase 10.1.8 / Phase 12 pre-req).
 *
 * - Credentials resolved from DB settings via preloadPusherConfig().
 * - Custom authorizer sends the CURRENT bearer token on every (re)auth, so
 *   token refreshes never break channel subscriptions.
 * - forceTLS + only ws/wss transports (10.1.10 TLS verification).
 * - Auto (re)connect is built into pusher-js; expose connection state via
 *   bindConnectionState for UI indicators (10.5.8 / 10.5.9).
 *
 * Prefer `ensurePusherClient()` in async contexts; `getPusherClient()` stays
 * sync for existing call sites.
 */
export async function ensurePusherClient(): Promise<Pusher | null> {
  await preloadPusherConfig();
  return getPusherClient();
}

export function getPusherClient(): Pusher | null {
  if (typeof window === 'undefined') return null;
  if (!PUSHER_KEY) return null;
  if (!client) {
    client = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
      authorizer: (channel) => ({
        authorize: (socketId, callback) => {
          const token = currentAccessToken();
          fetch(AUTH_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              socket_id: socketId,
              channel_name: channel.name,
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                let message = `channel auth failed (${res.status})`;
                try {
                  const body = (await res.json()) as { message?: string };
                  if (body?.message) message = body.message;
                } catch {
                  /* ignore parse errors */
                }
                throw new Error(message);
              }
              return res.json() as Promise<{ auth: string; channel_data?: string }>;
            })
            .then((data) => callback(null, data))
            .catch((err: Error) => callback(new Error(err.message), null));
        },
      }),
    });
  }
  return client;
}

export type ConnectionState =
  | 'initialized'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'unavailable'
  | 'failed';

/** Subscribe to the per-request chat channels (private + presence). */
export function subscribeRequestChannels(
  requestId: string | number,
  handlers: {
    onMessage?: (data: unknown) => void;
    onMessageRead?: (data: unknown) => void;
    onTyping?: (data: unknown) => void;
    onStatusChanged?: (data: unknown) => void;
    onPriceChanged?: (data: unknown) => void;
    onDeleted?: (data: unknown) => void;
  },
): { privateChannel: Channel | null; presenceChannel: Channel | null } {
  const pusher = getPusherClient();
  if (!pusher) return { privateChannel: null, presenceChannel: null };

  const privateChannel = pusher.subscribe(PUSHER_CONFIG.PRIVATE_REQUEST_CHANNEL(requestId));
  if (handlers.onMessage) privateChannel.bind('MessageSent', handlers.onMessage);
  if (handlers.onMessageRead) privateChannel.bind('MessageRead', handlers.onMessageRead);
  if (handlers.onDeleted) privateChannel.bind('MessageDeleted', handlers.onDeleted);
  if (handlers.onStatusChanged)
    privateChannel.bind('RequestStatusChanged', handlers.onStatusChanged);
  if (handlers.onPriceChanged) privateChannel.bind('RequestPriceChanged', handlers.onPriceChanged);

  // 10.5.5 — typing indicator via client events on the presence channel
  const presenceChannel = pusher.subscribe(PUSHER_CONFIG.PRESENCE_REQUEST_CHANNEL(requestId));
  if (handlers.onTyping) presenceChannel.bind('client-typing', handlers.onTyping);

  return { privateChannel, presenceChannel };
}

/** Unsubscribe both request channels (on unmount). */
export function unsubscribeRequestChannels(requestId: string | number): void {
  const pusher = getPusherClient();
  if (!pusher) return;
  pusher.unsubscribe(PUSHER_CONFIG.PRIVATE_REQUEST_CHANNEL(requestId));
  pusher.unsubscribe(PUSHER_CONFIG.PRESENCE_REQUEST_CHANNEL(requestId));
}

export function emitTyping(
  requestId: string | number,
  from: { id: string; name?: string | null },
): void {
  const pusher = getPusherClient();
  if (!pusher) return;
  const channel = pusher.channel(PUSHER_CONFIG.PRESENCE_REQUEST_CHANNEL(requestId));
  if (channel && channel.trigger) {
    channel.trigger('client-typing', {
      userId: from.id,
      name: from.name,
      at: Date.now(),
    });
  }
}

/** Who is online right now (presence members). */
export function presenceMembers(channel: Channel | null): Array<{ id: string; name?: string }> {
  if (!channel) return [];
  const members: Array<{ id: string; name?: string }> = [];
  const presence = channel as Channel & {
    members?: { each: (cb: (member: { id: string; info?: { name?: string } }) => void) => void };
  };
  presence.members?.each((member) => {
    members.push({ id: member.id, name: member.info?.name });
  });
  return members;
}

/** Connection-state watcher for the connection indicator (10.5.8). */
export function bindConnectionState(
  onChange: (state: ConnectionState, prevState: ConnectionState) => void,
): () => void {
  const pusher = getPusherClient();
  if (!pusher) return () => undefined;

  const handler = ({
    current,
    previous,
  }: {
    current: ConnectionState;
    previous: ConnectionState;
  }) => {
    onChange(current, previous);
  };
  pusher.connection.bind('state_change', handler);
  return () => pusher.connection.unbind('state_change', handler);
}

export const PusherChannels = PUSHER_CONFIG;
