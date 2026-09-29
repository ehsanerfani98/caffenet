'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/lib/stores/ui-store';

/**
 * Bottom Sheet (7.2.5) — Radix Dialog anchored to the bottom,
 * controlled globally via the UI store so any component can open it.
 */
export function BottomSheet() {
  const { sheet, closeSheet } = useUiStore();

  return (
    <DialogPrimitive.Root open={sheet.isOpen} onOpenChange={(open) => !open && closeSheet()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          dir="rtl"
          className={cn(
            'max-w-mobile fixed inset-x-0 bottom-0 z-50 mx-auto rounded-t-3xl bg-white',
            'p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
          )}
        >
          {/* Drag handle */}
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200" />
          {sheet.title && (
            <DialogPrimitive.Title className="mb-3 text-base font-bold text-gray-900">
              {sheet.title}
            </DialogPrimitive.Title>
          )}
          <DialogPrimitive.Description className="sr-only">
            پنجره پایین صفحه
          </DialogPrimitive.Description>
          {sheet.content}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
