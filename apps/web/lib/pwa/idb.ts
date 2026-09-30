/**
 * Minimal IndexedDB helpers (Phase 12.2.7) — shared by the page context and
 * the service worker. No dependencies (workbox/next-pwa do not ship an IDB
 * wrapper and external ones are unnecessary for two tiny stores).
 *
 * Stores:
 *   kv          — { key, value } (access-token mirror readable from the SW)
 *   chat_outbox — queued chat messages that failed to send offline
 */

export const DB_NAME = 'caffenet-pwa';
export const DB_VERSION = 1;
export const STORE_KV = 'kv';
export const STORE_CHAT_OUTBOX = 'chat_outbox';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_CHAT_OUTBOX)) {
        const store = db.createObjectStore(STORE_CHAT_OUTBOX, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export async function idbPut(store: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(store, 'readwrite');
    await requestToPromise(tx.objectStore(store).put(value as never));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('tx failed'));
    });
  } finally {
    db.close();
  }
}

export async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  try {
    const tx = db.transaction(store, 'readonly');
    return await requestToPromise<T | undefined>(
      tx.objectStore(store).get(key) as IDBRequest<T | undefined>,
    );
  } finally {
    db.close();
  }
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(store, 'readonly');
    return await requestToPromise<T[]>(tx.objectStore(store).getAll() as IDBRequest<T[]>);
  } finally {
    db.close();
  }
}

export async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(store, 'readwrite');
    await requestToPromise(tx.objectStore(store).delete(key));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('tx failed'));
    });
  } finally {
    db.close();
  }
}

// --------------------------------------------------------------------------
// access-token mirror (readable from the service worker — localStorage is NOT)
// --------------------------------------------------------------------------

const TOKEN_KEY = 'access_token';

export async function mirrorTokenToIdb(token: string | null): Promise<void> {
  try {
    if (token) {
      await idbPut(STORE_KV, { key: TOKEN_KEY, value: token });
    } else {
      await idbDelete(STORE_KV, TOKEN_KEY);
    }
  } catch {
    // non-fatal — background sync simply won't have a token until next login
  }
}

export async function readTokenFromIdb(): Promise<string | null> {
  try {
    const row = await idbGet<{ key: string; value: string }>(STORE_KV, TOKEN_KEY);
    return row?.value ?? null;
  } catch {
    return null;
  }
}
