/**
 * Chat outbox (Phase 12.2.7 — Background Sync for failed chat messages).
 *
 * Flow:
 *  1. Page: text send fails with a NETWORK error (no HTTP response) →
 *     `enqueueChatMessage()` + registerSync + keep the optimistic bubble.
 *  2. SW: `sync` event (or Safari/Firefox fallback: the `online` event in the
 *     page) → `flushChatOutbox()` POSTs each queued message to the API with
 *     the bearer token mirrored into IndexedDB.
 *  3. Delivered items are removed; the realtime MessageSent event replaces
 *     the optimistic bubble with the persisted message.
 */

import { STORE_CHAT_OUTBOX, idbDelete, idbGetAll, idbPut, readTokenFromIdb } from './idb';

export const CHAT_SYNC_TAG = 'caffenet-chat-sync';

export interface ChatOutboxItem {
  /** Local unique id (also the optimistic bubble id, `tmp-…`). */
  id: string;
  requestId: string;
  body: string;
  createdAt: string;
  attempts: number;
}

export async function enqueueChatMessage(item: Omit<ChatOutboxItem, 'attempts'>): Promise<void> {
  await idbPut(STORE_CHAT_OUTBOX, { ...item, attempts: 0 });
}

export async function listChatOutbox(): Promise<ChatOutboxItem[]> {
  const items = await idbGetAll<ChatOutboxItem>(STORE_CHAT_OUTBOX);
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeChatOutboxItem(id: string): Promise<void> {
  await idbDelete(STORE_CHAT_OUTBOX, id);
}

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
}

/**
 * POST one queued message directly (used inside the SW where the axios
 * instance is unavailable). Returns the persisted message JSON on success.
 */
async function postQueuedMessage(item: ChatOutboxItem, token: string): Promise<unknown> {
  const res = await fetch(`${apiBase()}/requests/${item.requestId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ body: item.body }),
  });
  if (!res.ok) {
    const err = new Error(`outbox send failed (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Flush ALL queued messages (FIFO). Network/5xx errors keep the item for the
 * next sync; 4xx (validation, permissions, deleted room …) drop it — retrying
 * would never succeed.
 *
 * Returns the successfully-sent payloads keyed by the outbox item id so the
 * page can reconcile optimistic bubbles.
 */
export async function flushChatOutbox(): Promise<Array<{ id: string; message: unknown }>> {
  const items = await listChatOutbox();
  if (items.length === 0) return [];

  const token = await readTokenFromIdb();
  const delivered: Array<{ id: string; message: unknown }> = [];

  for (const item of items) {
    try {
      const message = await postQueuedMessage(item, token ?? '');
      delivered.push({ id: item.id, message });
      await removeChatOutboxItem(item.id);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status && status >= 400 && status < 500) {
        // permanent — drop
        await removeChatOutboxItem(item.id);
      }
      // transient (offline/5xx) → keep for the next sync; stop on network loss
      if (!status) break;
    }
  }
  return delivered;
}

/**
 * Register a Background Sync (Chromium). Returns false where unsupported —
 * the page falls back to flushing on the `online` event.
 */
export async function registerChatSync(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (!registration.sync) return false;
    await registration.sync.register(CHAT_SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}
