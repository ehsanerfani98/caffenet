'use client';

import { notificationsApi } from '@/lib/api/notifications';
import { useNotificationStore } from '@/lib/stores/notification-store';

/**
 * Web Push registration flow (Phase 11.4.1–11.4.4 client side).
 *
 *  1. Register the service worker (next-pwa generates /sw.js at build time).
 *  2. Ask for the notification permission (must be a user gesture upstream).
 *  3. Fetch the VAPID public key from the API.
 *  4. Subscribe via pushManager and POST the subscription to /push/subscribe.
 *
 * The unsubscribe path mirrors it (11.4.4).
 */

export type PushSetupResult =
  | { ok: true; endpoint: string }
  | {
      ok: false;
      reason: 'unsupported' | 'denied' | 'server-disabled' | 'subscribe-failed' | 'no-sw';
    };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function deviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function detectBrowserName(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'unknown';
}

/** Subscribe this browser to Web Push and persist the subscription. */
export async function enableWebPush(): Promise<PushSetupResult> {
  if (typeof window === 'undefined') return { ok: false, reason: 'unsupported' };
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return { ok: false, reason: 'unsupported' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const vapid = await notificationsApi.vapidPublicKey().catch(() => null);
  if (!vapid?.enabled || !vapid.publicKey) return { ok: false, reason: 'server-disabled' };

  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
    // Ensure the (possibly updated) SW is active before subscribing
    await navigator.serviceWorker.ready;
    void registration;
  } catch {
    return { ok: false, reason: 'no-sw' };
  }

  try {
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey) as BufferSource,
      }));

    const json = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
      return { ok: false, reason: 'subscribe-failed' };
    }

    await notificationsApi.subscribe({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: detectBrowserName(),
      deviceType: deviceType(),
    });

    useNotificationStore.getState().setPref('pushEnabled', true);
    return { ok: true, endpoint: json.endpoint };
  } catch {
    return { ok: false, reason: 'subscribe-failed' };
  }
}

/** Unsubscribe this browser from Web Push (11.4.4). */
export async function disableWebPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await notificationsApi.unsubscribe(subscription.endpoint).catch(() => undefined);
      await subscription.unsubscribe();
    }
    useNotificationStore.getState().setPref('pushEnabled', false);
    return true;
  } catch {
    return false;
  }
}
