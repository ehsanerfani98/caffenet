/**
 * Web Push display handlers (Phase 11.4 client side) — imported into the
 * generated next-pwa service worker via `importScripts: ['/push-sw.js']`.
 *
 *  - `push` (11.4 / display side of 12.2.8): shows a system notification for
 *    the payload sent by the API NotificationService:
 *      { title, body, data: { link, ... }, tag }
 *  - `notificationclick`: focuses an existing window on `data.link` or opens
 *    a new one (full UX polish lands with 12.2.9).
 */

/* eslint-disable no-restricted-globals */
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
