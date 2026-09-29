'use client';

import { cn } from '@/lib/utils';

/**
 * DataTable (9.x) — generic admin table.
 *  - Sticky header, zebra rows, RTL right-aligned
 *  - Horizontal scroll wrapper for mobile (360px+)
 *  - Optional loading / empty rendering handled by the caller via children swap
 */

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  render?: (row: Row) => React.ReactNode;
  className?: string;
}

export function DataTable<Row extends object>({
  columns,
  rows,
  loading,
  emptyText = 'موردی یافت نشد',
  onRowClick,
  rowClassName,
}: {
  columns: Array<DataTableColumn<Row>>;
  rows: Row[];
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (row: Row) => void;
  rowClassName?: (row: Row) => string | undefined;
}) {
  const cellOf = (row: Row, key: string): React.ReactNode => {
    const rec = row as Record<string, unknown>;
    return (rec[key] as React.ReactNode) ?? '—';
  };
  const keyOf = (row: Row, i: number): string => {
    const rec = row as Record<string, unknown>;
    return String(rec.id ?? rec.uuid ?? i);
  };
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <div className="min-w-[640px]">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap border-b border-gray-200 px-4 py-3 text-xs font-bold text-gray-500',
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-gray-100">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200/80" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, i) => (
                  <tr
                    key={keyOf(row, i)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'hover:bg-brand-50/50 border-b border-gray-100 transition-colors last:border-0 odd:bg-white even:bg-gray-50/60',
                      onRowClick && 'cursor-pointer',
                      rowClassName?.(row),
                    )}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn('px-4 py-3 align-middle text-gray-700', c.className)}
                      >
                        {c.render ? c.render(row) : cellOf(row, c.key)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-7 w-7"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0H4"
                />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-700">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
