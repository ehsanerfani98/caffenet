'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
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
