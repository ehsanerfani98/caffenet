'use client';

import Pusher from 'pusher-js';
import { PUSHER_CONFIG } from '@caffenet/shared';

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';
const AUTH_ENDPOINT =
  process.env.NEXT_PUBLIC_PUSHER_AUTH_ENDPOINT ||
  `${process.env.NEXT_PUBLIC_API_URL}/broadcasting/auth`;

let client: Pusher | null = null;

export function getPusherClient(): Pusher | null {
  if (!PUSHER_KEY) {
    console.warn('Pusher key missing — real-time disabled');
    return null;
  }
  if (!client) {
    client = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      authEndpoint: AUTH_ENDPOINT,
      auth: {
        headers: {
          Authorization: `Bearer ${typeof window !== 'undefined' ? window.localStorage.getItem('access_token') ?? '' : ''}`,
        },
      },
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
    });
  }
  return client;
}

export const PusherChannels = PUSHER_CONFIG;
