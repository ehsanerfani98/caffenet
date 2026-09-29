'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Error state (7.2.10) — friendly error with retry.
 */

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'خطایی رخ داد',
  description = 'دوباره تلاش کنید. اگر مشکل ادامه داشت با پشتیبانی تماس بگیرید.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-400">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h3 className="text-base font-bold text-gray-800">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-gray-500">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RotateCcw className="ml-1.5 h-4 w-4" />
          تلاش مجدد
        </Button>
      )}
    </div>
  );
}
