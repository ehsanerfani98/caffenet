'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Download, Search } from 'lucide-react';
import { useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { adminAuditApi, type AuditLogItemDto } from '@/lib/api/admin';
import { formatJalaliDateTime, toPersianDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Audit logs (9.11.1–9.11.3) — filters (user id, action, entity, date range),
 * table, expandable old-vs-new diff viewer (red removed / green added), CSV export.
 */

const ACTIONS = [
  { key: '', label: 'همه اقدامات' },
  { key: 'login', label: 'ورود' },
  { key: 'logout', label: 'خروج' },
  { key: 'create', label: 'ایجاد' },
  { key: 'update', label: 'به‌روزرسانی' },
  { key: 'delete', label: 'حذف' },
  { key: 'assign', label: 'تخصیص' },
  { key: 'revoke', label: 'سلب' },
  { key: 'price_change', label: 'تغییر قیمت' },
  { key: 'status_change', label: 'تغییر وضعیت' },
  { key: 'wallet_adjust', label: 'تعدیل کیف پول' },
  { key: 'refund_issue', label: 'بازگشت وجه' },
  { key: 'permission_change', label: 'تغییر مجوز' },
  { key: 'role_change', label: 'تغییر نقش' },
  { key: 'setting_change', label: 'تغییر تنظیمات' },
];

const ENTITIES = [
  { key: '', label: 'همه موجودیت‌ها' },
  { key: 'user', label: 'کاربر' },
  { key: 'request', label: 'درخواست' },
  { key: 'payment', label: 'پرداخت' },
  { key: 'role', label: 'نقش' },
  { key: 'settings', label: 'تنظیمات' },
  { key: 'notification', label: 'اعلان' },
  { key: 'contact_method', label: 'روش تماس' },
  { key: 'discount', label: 'کد تخفیف' },
  { key: 'wallet', label: 'کیف پول' },
];

const ACTION_FA: Record<string, string> = Object.fromEntries(
  ACTIONS.filter((a) => a.key).map((a) => [a.key, a.label]),
);
const ENTITY_FA: Record<string, string> = Object.fromEntries(
  ENTITIES.filter((e) => e.key).map((e) => [e.key, e.label]),
);

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const logs = useQuery({
    queryKey: ['admin-audit-logs', page, userId, action, entity, from, to],
    queryFn: () =>
      adminAuditApi.list({
        page,
        perPage: 25,
        userId: userId || undefined,
        action: action || undefined,
        entity: entity || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const items = logs.data?.items ?? [];

  const exportCsv = () => {
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['شناسه', 'زمان', 'کاربر', 'شماره', 'اقدام', 'موجودیت', 'شناسه موجودیت', 'IP'];
    const rows = items.map((a) => [
      a.id,
      a.createdAt,
      a.user?.fullName ?? '',
      a.user?.phone ?? '',
      ACTION_FA[a.action] ?? a.action,
      ENTITY_FA[a.entity] ?? a.entity,
      a.entityId ?? '',
      a.ip ?? '',
    ]);
    const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const columns: Array<DataTableColumn<AuditLogItemDto>> = [
    {
      key: 'action',
      header: 'اقدام',
      render: (a) => (
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-900">{ACTION_FA[a.action] ?? a.action}</p>
          <p className="text-[11px] text-gray-400">
            {ENTITY_FA[a.entity] ?? a.entity}
            {a.entityId ? ` — ${a.entityId}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'کاربر',
      render: (a) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-700">
            {a.user?.fullName ?? 'سیستم'}
          </p>
          <p dir="ltr" className="text-right text-[11px] text-gray-400">
            {a.user?.phone ?? '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'زمان',
      render: (a) => (
        <span className="text-xs text-gray-500">{formatJalaliDateTime(a.createdAt)}</span>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      render: (a) => (
        <span dir="ltr" className="block text-right font-mono text-[11px] text-gray-400">
          {a.ip ?? '—'}
        </span>
      ),
    },
    {
      key: 'expand',
      header: 'جزئیات',
      render: (a) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(expanded === a.id ? null : a.id);
          }}
          aria-expanded={expanded === a.id}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
        >
          تغییرات
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', expanded === a.id && 'rotate-180')}
          />
        </button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="لاگ ممیزی"
        description={
          logs.data
            ? `${toPersianDigits(logs.data.meta.total)} رخداد ثبت‌شده`
            : 'گزارش کامل تغییرات حساس سامانه'
        }
        actions={
          <button
            type="button"
            disabled={items.length === 0}
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            خروجی CSV
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-4 grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-gray-500">شناسه کاربر</span>
          <input
            dir="ltr"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
            placeholder="123"
            className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-gray-500">اقدام</span>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
          >
            {ACTIONS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-gray-500">موجودیت</span>
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
          >
            {ENTITIES.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-gray-500">از تاریخ</span>
          <input
            type="date"
            dir="ltr"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-gray-500">
            تا تاریخ
            <button
              type="button"
              onClick={() => {
                setUserId('');
                setAction('');
                setEntity('');
                setFrom('');
                setTo('');
                setPage(1);
              }}
              className="text-brand-600 text-[11px] font-bold hover:underline"
            >
              پاک‌سازی فیلترها
            </button>
          </span>
          <input
            type="date"
            dir="ltr"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
          />
        </label>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {logs.isError ? (
          <ErrorState title="خطا در دریافت لاگ‌ها" onRetry={() => logs.refetch()} />
        ) : !logs.isLoading && items.length === 0 ? (
          <EmptyState
            title="رخدادی یافت نشد"
            description="فیلترها را تغییر دهید"
            icon={<Search className="h-8 w-8" />}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={items}
              loading={logs.isLoading}
              emptyText="رخدادی یافت نشد"
            />
            {/* Diff viewers — rendered below the table for the expanded row */}
            {items
              .filter((a) => a.id === expanded)
              .map((a) => (
                <DiffViewer key={`diff-${a.id}`} entry={a} />
              ))}
          </>
        )}
        <Pagination page={page} totalPages={logs.data?.meta?.totalPages ?? 1} onChange={setPage} />
      </div>
    </div>
  );
}

// ===========================================================================
// Diff viewer (9.11.2) — old vs new, stacked (RTL), red removed / green added
// ===========================================================================

function DiffViewer({ entry }: { entry: AuditLogItemDto }) {
  const oldEntries = Object.entries(entry.oldData ?? {});
  const newEntries = Object.entries(entry.newData ?? {});

  const removed = oldEntries.filter(
    ([k, v]) => JSON.stringify(v) !== JSON.stringify((entry.newData ?? {})[k]),
  );
  const added = newEntries.filter(
    ([k, v]) => JSON.stringify(v) !== JSON.stringify((entry.oldData ?? {})[k]),
  );

  if (removed.length === 0 && added.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
        داده‌ای برای مقایسه ثبت نشده است.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4" dir="rtl">
      <p className="text-[11px] font-extrabold text-gray-600">
        مقایسه تغییرات — رخداد #{toPersianDigits(entry.id)}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-red-600">مقدار قبلی</p>
          {removed.length === 0 ? (
            <p className="text-[11px] text-gray-400">—</p>
          ) : (
            <ul className="space-y-1">
              {removed.map(([k, v]) => (
                <li key={k} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px]">
                  <span dir="ltr" className="block text-right font-mono text-red-400">
                    {k}
                  </span>
                  <span className="block break-all font-bold text-red-700 line-through decoration-red-300">
                    {String(v)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-brand-700 mb-1.5 text-[11px] font-bold">مقدار جدید</p>
          {added.length === 0 ? (
            <p className="text-[11px] text-gray-400">—</p>
          ) : (
            <ul className="space-y-1">
              {added.map(([k, v]) => (
                <li key={k} className="bg-brand-50 rounded-lg px-2.5 py-1.5 text-[11px]">
                  <span dir="ltr" className="text-brand-500 block text-right font-mono">
                    {k}
                  </span>
                  <span className="text-brand-800 block break-all font-bold">{String(v)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
