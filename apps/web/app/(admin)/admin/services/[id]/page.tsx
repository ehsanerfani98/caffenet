'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { ListSkeleton } from '@/components/common/Skeleton';
import { toast } from '@/components/ui/use-toast';
import {
  adminServicesApi,
  type ServiceDto,
  type ServiceFieldDto,
  type ServiceFieldOptionDto,
} from '@/lib/api/admin';
import { formatToman } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Dynamic form builder (9.6.3) — per-service field management:
 *  - field list with type badge, required flag, order
 *  - add/edit field: label, snake_case name, type (ServiceFieldType enum),
 *    options editor for select-like types, required toggle, help text
 *  - reorder up/down (PATCH …/fields/reorder)
 *  - delete field with confirm
 *
 * NOTE (backend gap): the ServiceField DTO currently has NO `visible_if`
 * conditional-visibility rule — 9.6.3 conditional display lands when the
 * backend adds it. The UI shows a hint instead of a rule editor.
 */

const FIELD_TYPES: Array<{ key: string; label: string; hasOptions: boolean }> = [
  { key: 'text', label: 'متن کوتاه', hasOptions: false },
  { key: 'textarea', label: 'متن بلند', hasOptions: false },
  { key: 'number', label: 'عدد', hasOptions: false },
  { key: 'email', label: 'ایمیل', hasOptions: false },
  { key: 'phone', label: 'تلفن', hasOptions: false },
  { key: 'date', label: 'تاریخ', hasOptions: false },
  { key: 'time', label: 'زمان', hasOptions: false },
  { key: 'datetime', label: 'تاریخ و زمان', hasOptions: false },
  { key: 'select', label: 'لیست انتخابی', hasOptions: true },
  { key: 'multiselect', label: 'چندانتخابی', hasOptions: true },
  { key: 'radio', label: 'رادیو', hasOptions: true },
  { key: 'checkbox', label: 'چک‌باکس', hasOptions: true },
  { key: 'file', label: 'فایل', hasOptions: false },
  { key: 'image', label: 'تصویر', hasOptions: false },
];

interface FieldForm {
  id: string | null;
  label: string;
  name: string;
  type: string;
  placeholder: string;
  helpText: string;
  required: boolean;
  defaultValue: string;
  optionsText: string; // one "value|label" per line (label optional → same as value)
}

const EMPTY_FIELD: FieldForm = {
  id: null,
  label: '',
  name: '',
  type: 'text',
  placeholder: '',
  helpText: '',
  required: false,
  defaultValue: '',
  optionsText: '',
};

function parseOptions(text: string): ServiceFieldOptionDto[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label] = line.split('|').map((p) => p.trim());
      return { value: value ?? '', label: label || value || '' };
    })
    .filter((o) => o.value.length > 0);
}

export default function ServiceFormBuilderPage() {
  const params = useParams<{ id: string }>();
  const serviceId = params?.id;
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FieldForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceFieldDto | null>(null);
  const [moving, setMoving] = useState(false);

  const service = useQuery({
    queryKey: ['admin-service', serviceId],
    queryFn: () => adminServicesApi.get(serviceId as string),
    enabled: Boolean(serviceId),
  });

  const fields = useQuery({
    queryKey: ['admin-service-fields', serviceId],
    queryFn: () => adminServicesApi.fields(serviceId as string),
    enabled: Boolean(serviceId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-service-fields', serviceId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-service', serviceId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-services'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const f = form!;
      const hasOptions = FIELD_TYPES.find((t) => t.key === f.type)?.hasOptions ?? false;
      if (f.id) {
        return adminServicesApi.updateField(serviceId as string, f.id, {
          label: f.label.trim(),
          placeholder: f.placeholder.trim() || undefined,
          helpText: f.helpText.trim() || undefined,
          required: f.required,
          defaultValue: f.defaultValue.trim() || undefined,
          ...(hasOptions ? { options: parseOptions(f.optionsText) } : {}),
        });
      }
      return adminServicesApi.addField(serviceId as string, {
        name: f.name.trim(),
        label: f.label.trim(),
        type: f.type,
        placeholder: f.placeholder.trim() || undefined,
        helpText: f.helpText.trim() || undefined,
        required: f.required,
        defaultValue: f.defaultValue.trim() || undefined,
        options: hasOptions ? parseOptions(f.optionsText) : undefined,
        active: true,
      });
    },
    onSuccess: () => {
      toast({ title: form?.id ? 'فیلد ویرایش شد' : 'فیلد افزوده شد' });
      setForm(null);
      invalidate();
    },
    onError: (e) => toast({ title: 'ذخیره فیلد ناموفق بود', description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (fieldId: string) => adminServicesApi.deleteField(serviceId as string, fieldId),
    onSuccess: () => {
      toast({ title: 'فیلد حذف شد' });
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => {
      toast({ title: 'حذف ناموفق بود', description: e.message });
      setDeleteTarget(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: Array<{ id: string; sortOrder: number }>) =>
      adminServicesApi.reorderFields(serviceId as string, items),
    onMutate: () => setMoving(true),
    onSettled: () => setMoving(false),
    onSuccess: () => invalidate(),
    onError: (e) => toast({ title: 'جابجایی ناموفق بود', description: e.message }),
  });

  if (service.isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="فرم‌ساز خدمت" backHref="/admin/catalog" />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  if (service.isError || !service.data) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="فرم‌ساز خدمت" backHref="/admin/catalog" />
        <ErrorState title="خدمت یافت نشد" onRetry={() => service.refetch()} />
      </div>
    );
  }

  const s: ServiceDto & { fields?: ServiceFieldDto[] } = service.data;
  const fieldItems = fields.data ?? [];

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= fieldItems.length) return;
    const next = [...fieldItems];
    const a = next[index]!;
    const b = next[target]!;
    next[index] = b;
    next[target] = a;
    reorderMutation.mutate(next.map((f, i) => ({ id: f.id, sortOrder: i })));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={`فرم‌ساز: ${s.name}`}
        description={`دستمزد پایه: ${formatToman(s.laborFee)} — ${s.category?.name ?? ''}`}
        backHref="/admin/catalog"
        actions={
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FIELD })}
            className="bg-brand-500 hover:bg-brand-600 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            فیلد جدید
          </button>
        }
      />

      {/* Backend gap hint */}
      <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50/60 p-3.5 text-[11px] leading-relaxed text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          نمایش شرطی فیلدها (visible_if) هنوز در API پشتیبانی نمی‌شود؛ فیلدها همیشه در فرم مشتری
          نمایش داده می‌شوند. ترتیب و اجبار بودن فیلدها از همین صفحه قابل مدیریت است.
        </p>
      </div>

      {/* Field list */}
      {fields.isLoading ? (
        <ListSkeleton rows={4} />
      ) : fields.isError ? (
        <ErrorState title="خطا در دریافت فیلدها" onRetry={() => fields.refetch()} />
      ) : fieldItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <p className="text-sm font-bold text-gray-700">هنوز فیلدی تعریف نشده است</p>
          <p className="mt-1 text-xs text-gray-400">
            با «فیلد جدید» اولین ورودی فرم مشتری را بسازید
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {fieldItems.map((f, index) => {
            return (
              <li
                key={f.id}
                className={cn(
                  'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-opacity',
                  moving && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-extrabold text-gray-900">{f.label}</p>
                      <span
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600"
                        dir="ltr"
                      >
                        {f.type}
                      </span>
                      {f.required && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          اجباری
                        </span>
                      )}
                      {!f.active && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          غیرفعال
                        </span>
                      )}
                    </div>
                    <p dir="ltr" className="mt-1 text-right text-[11px] text-gray-400">
                      {f.name}
                    </p>
                    {f.helpText && <p className="mt-1 text-[11px] text-gray-500">{f.helpText}</p>}
                    {f.options && f.options.length > 0 && (
                      <p className="mt-1.5 text-[11px] text-gray-500">
                        گزینه‌ها: {f.options.map((o) => o.label).join('، ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label="انتقال به بالا"
                      disabled={index <= 0}
                      onClick={() => move(index, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="انتقال به پایین"
                      disabled={index >= fieldItems.length - 1}
                      onClick={() => move(index, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="ویرایش فیلد"
                      onClick={() =>
                        setForm({
                          id: f.id,
                          label: f.label,
                          name: f.name,
                          type: f.type,
                          placeholder: f.placeholder ?? '',
                          helpText: f.helpText ?? '',
                          required: f.required,
                          defaultValue: f.defaultValue ?? '',
                          optionsText: (f.options ?? [])
                            .map((o) =>
                              o.label && o.label !== o.value ? `${o.value}|${o.label}` : o.value,
                            )
                            .join('\n'),
                        })
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="حذف فیلد"
                      onClick={() => setDeleteTarget(f)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* ===== Field form dialog ===== */}
      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="فرم فیلد"
        >
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setForm(null)}
            aria-hidden
          />
          <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-extrabold text-gray-900">
              {form.id ? 'ویرایش فیلد' : 'فیلد جدید'}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  برچسب (فارسی) *
                </span>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  نام فیلد (snake_case انگلیسی) {form.id ? '— غیرقابل تغییر' : '*'}
                </span>
                <input
                  dir="ltr"
                  value={form.name}
                  disabled={!!form.id}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="tracking_code"
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:bg-white disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">نوع فیلد *</span>
                <select
                  value={form.type}
                  disabled={!!form.id}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white disabled:opacity-60"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">مقدار پیش‌فرض</span>
                <input
                  value={form.defaultValue}
                  onChange={(e) => setForm({ ...form, defaultValue: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  متن راهنما (placeholder)
                </span>
                <input
                  value={form.placeholder}
                  onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  متن کمکی (زیر فیلد)
                </span>
                <input
                  value={form.helpText}
                  onChange={(e) => setForm({ ...form, helpText: e.target.value })}
                  className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                />
              </label>
              {(FIELD_TYPES.find((t) => t.key === form.type)?.hasOptions ?? false) && (
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-500">
                    گزینه‌ها — هر خط یک مورد، قالب: value|برچسب
                  </span>
                  <textarea
                    dir="ltr"
                    rows={4}
                    value={form.optionsText}
                    onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
                    placeholder={'urgent|فوری\nnormal|معمولی'}
                    className="focus:border-brand-400 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:bg-white"
                  />
                </label>
              )}
              <label className="flex items-center justify-between rounded-xl border border-gray-100 p-3 sm:col-span-2">
                <span className="text-xs font-bold text-gray-700">
                  پاسخ به این فیلد اجباری باشد
                </span>
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) => setForm({ ...form, required: e.target.checked })}
                  className="accent-brand-600 h-4 w-4"
                />
              </label>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={
                  saveMutation.isPending ||
                  form.label.trim().length < 1 ||
                  (!form.id && !/^[a-z][a-z0-9_]*$/.test(form.name.trim()))
                }
                onClick={() => saveMutation.mutate()}
                className="bg-brand-500 hover:bg-brand-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره فیلد'}
              </button>
            </div>
            {!form.id && !/^[a-z][a-z0-9_]*$/.test(form.name.trim()) && form.name.length > 0 && (
              <p className="mt-2 text-[11px] text-red-500">
                نام فیلد باید با حرف کوچک انگلیسی شروع شود و فقط حروف کوچک، عدد و زیرخط داشته باشد.
              </p>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="حذف فیلد"
        description={`فیلد «${deleteTarget?.label ?? ''}» از فرم خدمت حذف می‌شود. مقادیر ثبت‌شده قبلی حفظ می‌شوند.`}
        confirmLabel="حذف"
        pending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
