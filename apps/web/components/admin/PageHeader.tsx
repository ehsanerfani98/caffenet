'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * PageHeader (9.x) — title + optional description + action buttons + back link.
 * Used at the top of every admin page (desktop: inline in the shell content).
 */
export function PageHeader({
  title,
  description,
  backHref,
  actions,
}: {
  title: string;
  description?: string;
  backHref?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        {backHref && (
          <Link
            href={backHref}
            aria-label="بازگشت"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 sm:text-xl">{title}</h1>
          {description && <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
