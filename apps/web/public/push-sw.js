/**
 * Web Push display handlers (Phase 11.4 client side) — imported into the
 * generated next-pwa service worker via `importScripts: ['/push-sw.js']`.
 *
 *  - `push` (11.4 / display side of 12.2.8): shows a system notification for
 *    the payload sent by the API NotificationService:
 *      { title, body, data: { link, ... }, tag }
 *  - `notificationclick`: focuses an existing window on `data.link` or opens
 *    a new one (12.2.9).
 *  - `sync` (12.2.7): Background Sync — flushes the chat outbox (IndexedDB)
 *    with the bearer token mirrored into the `kv` store by the page.
 */

/* eslint-disable no-restricted-globals */

const CAFFENET_DB = 'caffenet-pwa';
const CAFFENET_DB_VERSION = 1;
const STORE_KV = 'kv';
const STORE_CHAT_OUTBOX = 'chat_outbox';
const CHAT_SYNC_TAG = 'caffenet-chat-sync';

function openCaffenetDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CAFFENET_DB, CAFFENET_DB_VERSION);
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
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function dbGetAll(store) {
  return openCaffenetDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => {
          db.close();
          resolve(req.result || []);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      }),
  );
}

function dbDelete(store, key) {
  return openCaffenetDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

/** Access-token mirror (page writes it into the `kv` store on login/refresh). */
function readToken() {
  return dbGetAll(STORE_KV)
    .then((rows) => {
      const row = (rows || []).find((r) => r && r.key === 'access_token');
      return row ? row.value : null;
    })
    .catch(() => null);
}

function apiBase() {
  return (self.__CAFFENET_API_URL__ || '').replace(/\/$/, '');
}

/** POST a queued message; throws with `.status` for permanent failures. */
function postQueuedMessage(item, token) {
  return fetch(`${apiBase()}/requests/${item.requestId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ body: item.body }),
  }).then((res) => {
    if (!res.ok) {
      const err = new Error(`outbox send failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  });
}

function flushChatOutbox() {
  return dbGetAll(STORE_CHAT_OUTBOX)
    .then((items) => {
      const sorted = (items || []).sort((a, b) =>
        String(a.createdAt).localeCompare(String(b.createdAt)),
      );
      if (!sorted.length) return [];

      return readToken().then((token) => {
        let chain = Promise.resolve(true); // networkOk flag
        sorted.forEach((item) => {
          chain = chain.then((networkOk) => {
            if (!networkOk) return false;
            return postQueuedMessage(item, token)
              .then(() => dbDelete(STORE_CHAT_OUTBOX, item.id).then(() => true))
              .catch((err) => {
                if (err && err.status >= 400 && err.status < 500) {
                  // permanent failure — drop the item
                  return dbDelete(STORE_CHAT_OUTBOX, item.id).then(() => true);
                }
                // offline/5xx — stop this round, keep the rest for the next sync
                return false;
              });
          });
        });
        return chain.then(() => []);
      });
    })
    .catch(() => []);
}

// 12.2.7 — Background Sync (Chromium): fires when connectivity returns,
// even if every tab is closed.
self.addEventListener('sync', (event) => {
  if (event.tag === CHAT_SYNC_TAG) {
    event.waitUntil(flushChatOutbox());
  }
});

// Page → SW trigger for browsers WITHOUT Background Sync (Safari/Firefox):
// the page flushes on its own `online` event and asks the SW to retry too.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'CAFFENET_FLUSH_OUTBOX') {
    event.waitUntil ? event.waitUntil(flushChatOutbox()) : flushChatOutbox();
  }
  if (data.type === 'CAFFENET_SET_API_URL' && data.url) {
    self.__CAFFENET_API_URL__ = data.url;
  }
});

self.addEventListener('push', (event) => {
  let payload = { title: 'اعلان جدید', body: '', data: {} };
  try {
    payload = { ...payload, ...(event.data ? event.data.json() : {}) };
  } catch {
    payload.body = event.data ? event.data.text() : '';
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'اعلان جدید', {
      body: payload.body || '',
      tag: payload.tag || undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'fa',
      data: payload.data || {},
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.link;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (target) client.navigate && client.navigate(target);
          return client;
        }
      }
      return self.clients.openWindow(target || '/');
    }),
  );
});
