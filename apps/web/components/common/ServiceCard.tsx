'use client';

import { Clock, FileText } from 'lucide-react';
import Link from 'next/link';
import { formatToman, toPersianDigits } from '@/lib/format';
import type { ServiceDto } from '@/lib/api/catalog';

/**
 * ServiceCard (7.5.4) — horizontal card for service lists / home.
 */
export function ServiceCard({ service }: { service: ServiceDto }) {
  return (
    <Link
      href={`/service/${service.slug}`}
      className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-colors active:bg-gray-50"
    >
      <div className="bg-brand-50 text-brand-600 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl">
        {service.icon ? <span aria-hidden>{service.icon}</span> : <FileText className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-bold text-gray-900">{service.name}</h3>
          {service.requiresFile && (
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
              نیاز به فایل
            </span>
          )}
        </div>
        {service.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{service.description}</p>
        )}
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="text-brand-700 font-semibold">{formatToman(service.laborFee)}</span>
          {service.estimatedDurationMin ? (
            <span className="flex items-center gap-1 text-gray-400">
              <Clock className="h-3 w-3" />~{toPersianDigits(service.estimatedDurationMin)} دقیقه
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
