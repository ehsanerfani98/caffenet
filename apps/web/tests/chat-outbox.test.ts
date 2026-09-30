/**
 * Chat outbox unit tests (Phase 12.2.7) — run against a minimal in-memory
 * IndexedDB shim that implements the exact surface lib/pwa/idb.ts uses.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --------------------------------------------------------------------------
// Minimal IndexedDB shim (Map-backed)
// --------------------------------------------------------------------------

interface FakeStore {
  data: Map<string, unknown>;
}

const stores: Record<string, FakeStore> = {
  kv: { data: new Map() },
  chat_outbox: { data: new Map() },
};

function makeRequest(result: unknown) {
  const req = {
    result,
    error: null,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onupgradeneeded: null as (() => void) | null,
  };
  queueMicrotask(() => req.onsuccess?.());
  return req;
}

class FakeTransaction {
  objectStore(name: string) {
    const store = stores[name]!;
    return {
      put: (value: { id?: string; key?: string }) => {
        const k = value.id ?? value.key;
        store.data.set(String(k), value);
        return makeRequest(undefined);
      },
      get: (key: string) => makeRequest(store.data.get(key)),
      getAll: () => makeRequest(Array.from(store.data.values())),
      delete: (key: string) => {
        store.data.delete(key);
        return makeRequest(undefined);
      },
    };
  }
  private _oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  // schedule the completion callback when it is assigned (mirrors real IDB:
  // tx completes after all pending requests resolve)
  set oncomplete(cb: (() => void) | null) {
    this._oncomplete = cb;
    if (cb) queueMicrotask(cb);
  }
  get oncomplete() {
    return this._oncomplete;
  }
}

class FakeIndexDB {
  open(_name: string, _version: number) {
    const req = {
      result: {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => ({ createIndex: () => undefined }),
        transaction: (_store: string) => new FakeTransaction(),
        close: () => undefined,
      },
      error: null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
    };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  }
}

vi.stubGlobal('indexedDB', new FakeIndexDB());

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

import { enqueueChatMessage, flushChatOutbox, listChatOutbox } from '@/lib/pwa/chat-outbox';
import { mirrorTokenToIdb, readTokenFromIdb } from '@/lib/pwa/idb';

beforeEach(() => {
  stores.kv!.data.clear();
  stores.chat_outbox!.data.clear();
});

describe('chat outbox (12.2.7)', () => {
  it('lists queued messages FIFO by createdAt', async () => {
    await enqueueChatMessage({
      id: 'tmp-2',
      requestId: '10',
      body: 'دوم',
      createdAt: '2026-01-01T10:00:00Z',
    });
    await enqueueChatMessage({
      id: 'tmp-1',
      requestId: '10',
      body: 'اول',
      createdAt: '2026-01-01T09:00:00Z',
    });
    const items = await listChatOutbox();
    expect(items.map((i) => i.body)).toEqual(['اول', 'دوم']);
  });

  it('delivers queued messages with the mirrored bearer token and clears them', async () => {
    await mirrorTokenToIdb('token-123');
    expect(await readTokenFromIdb()).toBe('token-123');

    await enqueueChatMessage({
      id: 'tmp-1',
      requestId: '7',
      body: 'سلام',
      createdAt: '2026-01-01T09:00:00Z',
    });

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
      return new Response(JSON.stringify({ id: '99', body: 'سلام' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const delivered = await flushChatOutbox();
    expect(delivered).toHaveLength(1);
    expect((delivered[0]!.message as { id: string }).id).toBe('99');
    expect(await listChatOutbox()).toHaveLength(0);
  });

  it('keeps messages for the next sync on network failure', async () => {
    await enqueueChatMessage({
      id: 'tmp-1',
      requestId: '7',
      body: 'آفلاین',
      createdAt: '2026-01-01T09:00:00Z',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const delivered = await flushChatOutbox();
    expect(delivered).toHaveLength(0);
    expect(await listChatOutbox()).toHaveLength(1);
  });

  it('drops messages on permanent 4xx failures', async () => {
    await enqueueChatMessage({
      id: 'tmp-1',
      requestId: '7',
      body: 'ممنوع',
      createdAt: '2026-01-01T09:00:00Z',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 })),
    );
    const delivered = await flushChatOutbox();
    expect(delivered).toHaveLength(0);
    expect(await listChatOutbox()).toHaveLength(0);
  });

  it('stops on first network failure but delivers earlier messages', async () => {
    await enqueueChatMessage({
      id: 'tmp-1',
      requestId: '7',
      body: 'اول',
      createdAt: '2026-01-01T09:00:00Z',
    });
    await enqueueChatMessage({
      id: 'tmp-2',
      requestId: '7',
      body: 'دوم',
      createdAt: '2026-01-01T09:01:00Z',
    });

    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) return new Response(JSON.stringify({ id: 'a' }), { status: 200 });
        throw new Error('network down');
      }),
    );

    const delivered = await flushChatOutbox();
    expect(delivered).toHaveLength(1);
    const rest = await listChatOutbox();
    expect(rest.map((i) => i.body)).toEqual(['دوم']);
  });
});
