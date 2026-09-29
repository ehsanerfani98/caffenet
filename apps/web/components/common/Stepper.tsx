'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toPersianDigits } from '@/lib/format';

/**
 * Stepper / progress indicator (7.6.7) — RTL horizontal steps.
 */

interface StepperProps {
  steps: string[];
  current: number; // 1-based
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-center">
        {steps.map((label, i) => {
          const stepNo = i + 1;
          const done = stepNo < current;
          const active = stepNo === current;
          return (
            <div key={label} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    done && 'bg-brand-600 text-white',
                    active && 'border-brand-600 text-brand-700 border-2 bg-white',
                    !done && !active && 'border border-gray-200 bg-white text-gray-400',
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : toPersianDigits(stepNo)}
                </div>
                <span
                  className={cn(
                    'max-w-[64px] text-center text-[10px] leading-tight',
                    active ? 'text-brand-700 font-bold' : 'text-gray-400',
                  )}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-1 mb-5 h-0.5 flex-1 rounded',
                    done ? 'bg-brand-600' : 'bg-gray-200',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
