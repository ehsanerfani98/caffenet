'use client';

import { useRef, useState } from 'react';

/**
 * Pull-to-refresh hook (7.2.4).
 * Attach the returned handlers to a scrollable container (or window);
 * dragging down past the threshold at scrollTop=0 triggers onRefresh.
 */

interface PullToRefreshOptions {
  onRefresh: () => Promise<unknown>;
  threshold?: number;
}

export function usePullToRefresh({ onRefresh, threshold = 70 }: PullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  const canPull = () => {
    if (refreshing) return false;
    // Pull only when the page itself is at the top
    return window.scrollY <= 0;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!canPull()) return;
    startY.current = e.touches[0]?.clientY ?? null;
    pulling.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || startY.current === null) return;
    const delta = (e.touches[0]?.clientY ?? startY.current) - startY.current;
    if (delta > 0) {
      // Rubber-band resistance
      setPullDistance(Math.min(delta * 0.45, 110));
    } else {
      setPullDistance(0);
    }
  };

  const onTouchEnd = async () => {
    pulling.current = false;
    startY.current = null;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(48);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  return {
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    pullDistance,
    refreshing,
  };
}
