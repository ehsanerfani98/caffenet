'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Copy, KeyRound, Save, ShieldOff, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { toast } from '@/components/ui/use-toast';
import {
  adminRolesApi,
  adminUsersApi,
  type AdminRoleDto,
  type AdminUserDetail,
} from '@/lib/api/admin';
import { formatJalaliDate, formatToman, toPersianDigits } from '@/lib/format';
import { requestStatusLabel, statusColorClass } from '@/lib/status-meta';
import { cn } from '@/lib/utils';

/**
 * User detail (9.3.2–9.3.7) — profile, edit (name/email), status control with
 * confirm, role assign/revoke, admin password reset with temp-password copy,
 * request stats mini-grid, wallet balance card, active sessions.
 */

const ROLE_FA: Record<string, string> = {
  customer: 'مشتری',
  operator: 'اپراتور',
  admin: 'ادمین',
};

const USER_STATUS_FA: Record<string, string> = {
  active: 'فعال',
  suspended: 'تعلیق',
  banned: 'مسدود',
  pending_otp: 'در انتظار تأیید',
};

const STATUS_OPTIONS: Array<{ key: string; label: string; description: string }> = [
  { key: 'active', label: 'فعال', description: 'کاربر با دسترسی کامل به سامانه' },
  { key: 'suspended', label: 'تعلیق موقت', description: 'ورود کاربر تا رفع تعلیق مسدود می‌شود' },
  { key: 'banned', label: 'مسدودسازی', description: 'دسترسی کامل قطع و همه نشست‌ها باطل می‌شود' },
];

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [formTouched, setFormTouched] = useState(false);
  const [statusTarget, setStatusTarget] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const detail = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => adminUsersApi.detail(id as string),
    enabled: Boolean(id),
  });

  const roles = useQuery({
    queryKey: ['admin-roles'],
    queryFn: adminRolesApi.list,
    staleTime: 5 * 60_000,
  });

  // Seed the edit form once loaded
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (detail.data && seededFor !== detail.data.user.id) {
    setFullName(detail.data.user.fullName ?? '');
    setEmail(detail.data.user.email ?? '');
    setSeededFor(detail.data.user.id);
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      adminUsersApi.update(id as string, {
        ...(fullName !== (detail.data?.user.fullName ?? '') ? { fullName } : {}),
        ...(email !== (detail.data?.user.email ?? '') ? { email } : {}),
      }),
    onSuccess: () => {
      toast({ title: 'اطلاعات کاربر ذخیره شد' });
      setFormTouched(false);
      invalidate();
    },
    onError: (e) => toast({ title: 'ذخیره ناموفق بود', description: e.message }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => adminUsersApi.update(id as string, { status }),
    onSuccess: () => {
      toast({ title: 'وضعیت کاربر به‌روزرسانی شد' });
      setStatusTarget(null);
      invalidate();
    },
    onError: (e) => {
      toast({ title: 'تغییر وضعیت ناموفق بود', description: e.message });
      setStatusTarget(null);
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: (roleId: string) => adminUsersApi.assignRole(id as string, roleId),
    onSuccess: () => {
      toast({ title: 'نقش اختصاص یافت' });
      setSelectedRoleId('');
      invalidate();
    },
    onError: (e) => toast({ title: 'اختصاص نقش ناموفق بود', description: e.message }),
  });

  const revokeRoleMutation = useMutation({
    mutationFn: (roleId: string) => adminUsersApi.revokeRole(id as string, roleId),
    onSuccess: () => {
      toast({ title: 'نقش سلب شد' });
      invalidate();
    },
    onError: (e) => toast({ title: 'سلب نقش ناموفق بود', description: e.message }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (password: string) => adminUsersApi.resetPassword(id as string, password),
    onSuccess: () => {
      toast({ title: 'رمز عبور تنظیم شد', description: 'همه نشست‌های کاربر باطل شده است' });
      setConfirmResetOpen(false);
      invalidate();
    },
    onError: (e) => toast({ title: 'تنظیم رمز ناموفق بود', description: e.message }),
  });

  if (detail.isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="جزئیات کاربر" backHref="/admin/users" />
        <DetailSkeleton />
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="جزئیات کاربر" backHref="/admin/users" />
        <ErrorState title="کاربر یافت نشد" onRetry={() => detail.refetch()} />
      </div>
    );
  }

  const d: AdminUserDetail = detail.data;
  const u = d.user;
  const unassignedRoles: AdminRoleDto[] = (roles.data ?? []).filter(
    (r) => !u.roles.some((ur) => ur.id === r.id),
  );
  const statsEntries = Object.entries(d.requestStats);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={u.fullName ?? u.phone}
        description={`شناسه: ${u.uuid}`}
        backHref="/admin/users"
      />

      {/* ============ Profile card ============ */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-brand-100 text-brand-700 flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-extrabold">
              {(u.fullName ?? u.phone).trim().charAt(0)}
            </div>
            <div>
              <p className="text-base font-extrabold text-gray-900">{u.fullName ?? '—'}</p>
              <p dir="ltr" className="mt-0.5 text-right text-sm text-gray-500">
                {u.phone}
              </p>
              {u.email && (
                <p dir="ltr" className="text-right text-xs text-gray-400">
                  {u.email}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-xs text-gray-500">
            <span
              className={cn(
                'inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                u.status === 'active'
                  ? 'border-brand-200 bg-brand-50 text-brand-700'
                  : u.status === 'banned'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700',
              )}
            >
              {USER_STATUS_FA[u.status] ?? u.status}
            </span>
            <span>عضویت: {formatJalaliDate(u.createdAt)}</span>
            <span>آخرین ورود: {formatJalaliDate(u.lastLoginAt)}</span>
            <span>نشست‌های فعال: {toPersianDigits(d.activeSessions)}</span>
          </div>
        </div>

        {/* Roles chips */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-bold text-gray-500">نقش‌ها (9.3.4)</p>
          <div className="flex flex-wrap items-center gap-2">
            {u.roles.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-1 pr-3 text-xs font-semibold text-gray-700"
              >
                {ROLE_FA[r.slug] ?? r.name}
                <button
                  type="button"
                  aria-label={`سلب نقش ${r.name}`}
                  onClick={() => revokeRoleMutation.mutate(r.id)}
                  disabled={revokeRoleMutation.isPending}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <ShieldOff className="h-3 w-3" />
                </button>
              </span>
            ))}
            {u.roles.length === 0 && (
              <span className="text-xs text-gray-400">نقشی اختصاص نیافته است</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              aria-label="انتخاب نقش برای اختصاص"
              className="focus:border-brand-400 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 outline-none"
            >
              <option value="">انتخاب نقش…</option>
              {unassignedRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {ROLE_FA[r.slug] ?? r.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedRoleId || assignRoleMutation.isPending}
              onClick={() => assignRoleMutation.mutate(selectedRoleId)}
              className="bg-brand-500 hover:bg-brand-600 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition-colors disabled:opacity-40"
            >
              اختصاص نقش
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ============ Edit profile (9.3.3) ============ */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-extrabold text-gray-800">ویرایش اطلاعات</h2>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">
                نام و نام خانوادگی
              </span>
              <input
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setFormTouched(true);
                }}
                className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">ایمیل</span>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormTouched(true);
                }}
                className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
              />
            </label>
            <button
              type="button"
              disabled={!formTouched || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
              className="bg-brand-500 hover:bg-brand-600 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
            </button>
          </div>
        </section>

        {/* ============ Status control (9.3.6) ============ */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-extrabold text-gray-800">وضعیت دسترسی</h2>
          <div className="space-y-2">
            {STATUS_OPTIONS.map((opt) => {
              const current = u.status === opt.key;
              return (
                <div
                  key={opt.key}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-xl border p-3',
                    current ? 'border-brand-300 bg-brand-50/60' : 'border-gray-100',
                  )}
                >
                  <div>
                    <p className="text-xs font-bold text-gray-800">{opt.label}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">{opt.description}</p>
                  </div>
                  {current ? (
                    <CheckCircle2 className="text-brand-600 h-5 w-5 shrink-0" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStatusTarget(opt.key)}
                      className={cn(
                        'shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
                        opt.key === 'active'
                          ? 'bg-brand-500 hover:bg-brand-600 text-white'
                          : 'bg-red-500 text-white hover:bg-red-600',
                      )}
                    >
                      {opt.key === 'active' ? 'فعال‌سازی' : 'اعمال'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ============ Reset password (9.3.5) ============ */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-gray-800">
            <KeyRound className="text-brand-600 h-4 w-4" />
            تنظیم رمز عبور
          </h2>
          <p className="mb-4 text-[11px] leading-relaxed text-gray-400">
            پس از تغییر رمز، همه نشست‌های فعال کاربر باطل می‌شود. رمز موقت را برای کاربر ارسال کنید.
          </p>
          <div className="flex items-center gap-2">
            <input
              dir="ltr"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="رمز موقت (حداقل ۸ نویسه)"
              className="focus:border-brand-400 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:bg-white"
            />
            <button
              type="button"
              aria-label="تولید رمز موقت"
              onClick={() => setTempPassword(generateTempPassword())}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(tempPassword).then(
                  () => toast({ title: 'رمز موقت کپی شد' }),
                  () => toast({ title: 'کپی ناموفق بود' }),
                );
              }}
              disabled={!tempPassword}
              className="rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              کپی رمز
            </button>
            <button
              type="button"
              disabled={tempPassword.length < 8 || resetPasswordMutation.isPending}
              onClick={() => setConfirmResetOpen(true)}
              className="rounded-xl bg-red-500 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-40"
            >
              ثبت رمز جدید
            </button>
          </div>
        </section>

        {/* ============ Wallet card (9.3.7) ============ */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-gray-800">
            <Wallet className="text-brand-600 h-4 w-4" />
            کیف پول کاربر
          </h2>
          {d.wallet ? (
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">موجودی فعلی</p>
              <p className="mt-1 text-xl font-extrabold text-gray-900">
                {formatToman(d.wallet.balanceToman)}
              </p>
              <p className="mt-2 text-[11px] text-gray-400">
                وضعیت:{' '}
                {d.wallet.status === 'active'
                  ? 'فعال'
                  : d.wallet.status === 'frozen'
                    ? 'مسدود (frozen)'
                    : 'بسته'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">این کاربر هنوز کیف پولی ندارد</p>
          )}
          <Link
            href={`/admin/finance?adjustUserId=${u.id}`}
            className="text-brand-600 mt-3 inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
          >
            تعدیل دستی موجودی ←
          </Link>
        </section>
      </div>

      {/* ============ Request stats mini-grid ============ */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-extrabold text-gray-800">آمار درخواست‌ها</h2>
        {statsEntries.length === 0 ? (
          <p className="text-xs text-gray-400">این کاربر درخواستی ثبت نکرده است</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statsEntries.map(([st, count]) => (
              <div
                key={st}
                className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center"
              >
                <p className="text-lg font-extrabold text-gray-900">{toPersianDigits(count)}</p>
                <span
                  className={cn(
                    'mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    statusColorClass(st),
                  )}
                >
                  {requestStatusLabel(st)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Confirm status change */}
      <ConfirmDialog
        open={statusTarget !== null}
        title={statusTarget === 'active' ? 'فعال‌سازی کاربر' : 'تغییر وضعیت کاربر'}
        description={
          statusTarget === 'banned'
            ? 'با مسدودسازی، دسترسی کاربر قطع و همه نشست‌های او باطل می‌شود. ادامه می‌دهید؟'
            : statusTarget === 'suspended'
              ? 'ورود کاربر تا رفع تعلیق مسدود می‌شود. ادامه می‌دهید؟'
              : 'دسترسی کاربر به‌طور کامل بازیابی می‌شود.'
        }
        confirmLabel={statusTarget === 'active' ? 'فعال‌سازی' : 'تأیید و اعمال'}
        pending={statusMutation.isPending}
        tone={statusTarget === 'active' ? 'primary' : 'danger'}
        onConfirm={() => statusTarget && statusMutation.mutate(statusTarget)}
        onCancel={() => setStatusTarget(null)}
      />

      {/* Confirm password reset */}
      <ConfirmDialog
        open={confirmResetOpen}
        title="ثبت رمز عبور جدید"
        description="همه نشست‌های فعال کاربر باطل می‌شود و کاربر باید با رمز جدید وارد شود. ادامه می‌دهید؟"
        confirmLabel="ثبت رمز"
        pending={resetPasswordMutation.isPending}
        onConfirm={() => resetPasswordMutation.mutate(tempPassword)}
        onCancel={() => setConfirmResetOpen(false)}
      >
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-gray-500">
            <Ban className="h-3 w-3" /> رمز جدید:
          </p>
          <p dir="ltr" className="break-all text-right font-mono text-sm font-bold text-gray-800">
            {tempPassword}
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
