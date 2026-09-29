'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Full-screen Modal (7.2.6) — slides over the whole viewport,
 * used for immersive flows (e.g. invoice preview, forms).
 */

interface FullScreenModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function FullScreenModal({ open, onClose, title, children }: FullScreenModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in fixed inset-0 z-50 bg-white" />
        <DialogPrimitive.Content
          dir="rtl"
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-white',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8',
          )}
        >
          <div className="safe-area-top flex h-14 items-center justify-between border-b border-gray-100 px-4">
            <DialogPrimitive.Title className="text-base font-bold text-gray-900">
              {title ?? ''}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="بستن"
              className="rounded-full p-2 text-gray-600 active:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">تمام صفحه</DialogPrimitive.Description>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
