'use client';

import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '@/lib/hooks/use-pull-to-refresh';
import { cn } from '@/lib/utils';

/**
 * Pull-to-refresh container (7.2.4). Wraps page content; shows a spinner
 * indicator that scales with the pull distance above the content.
 */

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const { bind, pullDistance, refreshing } = usePullToRefresh({ onRefresh });

  return (
    <div {...bind} className={cn('touch-pan-y', className)}>
      <div
        className="flex justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: pullDistance }}
      >
        <RefreshCw
          className={cn('text-brand-600 mt-2 h-5 w-5', refreshing && 'animate-spin')}
          style={{ transform: `rotate(${pullDistance * 3}deg)` }}
        />
      </div>
      {children}
    </div>
  );
}
