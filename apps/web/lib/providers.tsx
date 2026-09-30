'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';
import { NotificationRealtimeBridge } from '@/components/common/NotificationRealtimeBridge';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Phase 12.2.7 — hand the API base URL to the service worker so the chat
  // outbox flush (Background Sync) knows where to POST queued messages.
  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL;
    if (!api || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.active?.postMessage({ type: 'CAFFENET_SET_API_URL', url: api });
      })
      .catch(() => undefined);
  }, []);

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="light">
        {/* Phase 11.6 — private-user.{id} realtime notifications + badge + toast */}
        <NotificationRealtimeBridge />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
