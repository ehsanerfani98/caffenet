'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Lock, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/common/Skeleton';
import { toast } from '@/components/ui/use-toast';
import { adminRolesApi, type AdminRoleDto, type PermissionGroupDto } from '@/lib/api/admin';
import { toPersianDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Roles & permissions (9.5) — roles cards with system badge + users count,
 * create role (9.5.2), permission matrix editor with per-role save (9.5.3),
 * delete role with safeguard error display (9.5.4).
 */

const GROUP_FA: Record<string, string> = {
  users: 'کاربران',
  operators: 'اپراتورها',
  roles: 'نقش‌ها و مجوزها',
  requests: 'درخواست‌ها',
  wallet: 'کیف پول',
  payments: 'پرداخت‌ها',
  categories: 'دسته‌بندی‌ها',
  services: 'خدمات',
  discounts: 'تخفیف‌ها',
  reports: 'گزارش‌ها',
  audit_logs: 'لاگ ممیزی',
  notifications: 'اعلان‌ها',
  settings: 'تنظیمات',
  chat: 'چت',
  files: 'فایل‌ها',
  invoices: 'فاکتورها',
};

function faGroup(group: string): string {
  return GROUP_FA[group] ?? group;
}

/** Per-role editable copy of the permission matrix. */
function RolePermissionsCard({
  role,
  groups,
  onDelete,
}: {
  role: AdminRoleDto;
  groups: PermissionGroupDto[];
  onDelete: (role: AdminRoleDto) => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions));
  const [dirty, setDirty] = useState(false);
  const adminLocked = role.isSystem && role.slug === 'admin';

  const saveMutation = useMutation({
    mutationFn: () => adminRolesApi.updatePermissions(role.id, [...selected]),
    onSuccess: () => {
      toast({ title: 'مجوزهای نقش ذخیره شد' });
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (e) => toast({ title: 'ذخیره مجوزها ناموفق بود', description: e.message }),
  });

  const toggle = (slug: string) => {
    if (adminLocked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
    setDirty(true);
  };

  const toggleGroup = (group: PermissionGroupDto) => {
    if (adminLocked) return;
    const slugs = group.permissions.map((p) => p.slug);
    const allOn = slugs.every((s) => selected.has(s));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of slugs) {
        if (allOn) next.delete(s);
        else next.add(s);
      }
      return next;
    });
    setDirty(true);
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
            {role.name}
            {role.isSystem && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-bold text-white">
                <Lock className="h-2.5 w-2.5" /> سیستمی
              </span>
            )}
            {adminLocked && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                قابل تغییر نیست
              </span>
            )}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400">
            <Users className="h-3 w-3" />
            {toPersianDigits(role.usersCount)} کاربر · {toPersianDigits(selected.size)} مجوز
            {role.description ? ` — ${role.description}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!role.isSystem && (
            <button
              type="button"
              onClick={() => onDelete(role)}
              aria-label={`حذف نقش ${role.name}`}
              className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف
            </button>
          )}
          <button
            type="button"
            disabled={!dirty || adminLocked || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="bg-brand-500 hover:bg-brand-600 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition-colors disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
            {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره مجوزها'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {groups.map((g) => (
          <fieldset key={g.group} className="rounded-xl border border-gray-100 p-3">
            <legend className="flex items-center gap-2 px-1 text-xs font-extrabold text-gray-700">
              <button
                type="button"
                onClick={() => toggleGroup(g)}
                disabled={adminLocked}
                aria-label={`تغییر کل گروه ${faGroup(g.group)}`}
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                  g.permissions.every((p) => selected.has(p.slug))
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-gray-300 bg-white',
                  !adminLocked && 'hover:border-brand-400',
                )}
              >
                {g.permissions.every((p) => selected.has(p.slug)) && <Check className="h-3 w-3" />}
              </button>
              {faGroup(g.group)}
            </legend>
            <ul className="mt-2 space-y-2">
              {g.permissions.map((p) => {
                const on = selected.has(p.slug);
                return (
                  <li key={p.slug}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-lg p-1.5 text-xs transition-colors',
                        adminLocked && 'cursor-not-allowed opacity-70',
                        on ? 'bg-brand-50/60' : 'hover:bg-gray-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={adminLocked}
                        onChange={() => toggle(p.slug)}
                        className="accent-brand-600 mt-0.5 h-3.5 w-3.5 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block font-bold text-gray-700">{p.name}</span>
                        <span dir="ltr" className="block text-right text-[10px] text-gray-400">
                          {p.slug}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [createPerms, setCreatePerms] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<AdminRoleDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const roles = useQuery({ queryKey: ['admin-roles'], queryFn: adminRolesApi.list });
  const permissions = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: adminRolesApi.permissions,
    staleTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminRolesApi.create({
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        permissionSlugs: [...createPerms],
      }),
    onSuccess: () => {
      toast({ title: 'نقش جدید ایجاد شد' });
      setShowCreate(false);
      setForm({ name: '', slug: '', description: '' });
      setCreatePerms(new Set());
      void queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (e) => toast({ title: 'ایجاد نقش ناموفق بود', description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminRolesApi.remove(id),
    onSuccess: () => {
      toast({ title: 'نقش حذف شد' });
      setDeleteTarget(null);
      setDeleteError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (e) => {
      // Safeguard errors (system role / role has users) — show inline in dialog
      setDeleteError(e.message);
    },
  });

  const groups = permissions.data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="نقش‌ها و مجوزها"
        description={
          roles.data
            ? `${toPersianDigits(roles.data.length)} نقش تعریف‌شده`
            : 'مدیریت نقش‌ها و ماتریس مجوزها'
        }
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="bg-brand-500 hover:bg-brand-600 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            نقش جدید
          </button>
        }
      />

      {roles.isLoading || permissions.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : roles.isError || permissions.isError ? (
        <ErrorState
          title="خطا در دریافت نقش‌ها"
          onRetry={() => {
            roles.refetch();
            permissions.refetch();
          }}
        />
      ) : (
        (roles.data ?? []).map((role) => (
          <RolePermissionsCard
            key={role.id}
            role={role}
            groups={groups}
            onDelete={(r) => {
              setDeleteError(null);
              setDeleteTarget(r);
            }}
          />
        ))
      )}

      {/* ===== Create role dialog (9.5.2) ===== */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ایجاد نقش جدید"
        >
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
            aria-hidden
          />
          <div className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-extrabold text-gray-900">ایجاد نقش جدید</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  نام نقش * (فارسی)
                </span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  شناسه (slug) * — انگلیسی
                </span>
                <input
                  dir="ltr"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="support_agent"
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-gray-500">توضیحات</span>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
            </div>

            <p className="mb-2 mt-4 text-xs font-extrabold text-gray-700">
              مجوزها (اختیاری در ایجاد)
            </p>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.map((g) => (
                  <fieldset key={g.group} className="rounded-xl border border-gray-100 p-3">
                    <legend className="px-1 text-xs font-extrabold text-gray-700">
                      {faGroup(g.group)}
                    </legend>
                    <ul className="mt-1 space-y-1.5">
                      {g.permissions.map((p) => (
                        <li key={p.slug}>
                          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={createPerms.has(p.slug)}
                              onChange={() =>
                                setCreatePerms((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(p.slug)) next.delete(p.slug);
                                  else next.add(p.slug);
                                  return next;
                                })
                              }
                              className="accent-brand-600 h-3.5 w-3.5"
                            />
                            {p.name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={
                  createMutation.isPending ||
                  form.name.trim().length < 2 ||
                  form.slug.trim().length < 2
                }
                onClick={() => createMutation.mutate()}
                className="bg-brand-500 hover:bg-brand-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {createMutation.isPending ? 'در حال ایجاد…' : 'ایجاد نقش'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete role confirm (9.5.4) ===== */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="حذف نقش"
        description={`نقش «${deleteTarget?.name ?? ''}» برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست.`}
        confirmLabel="حذف نقش"
        pending={deleteMutation.isPending}
        onConfirm={() => {
          setDeleteError(null);
          deleteTarget && deleteMutation.mutate(deleteTarget.id);
        }}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      >
        {deleteError && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-relaxed text-red-600">
            {deleteError}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
