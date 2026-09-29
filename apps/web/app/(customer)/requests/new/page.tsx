'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  Phone,
  Send,
  User,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  DynamicForm,
  validateDynamicForm,
  type DynamicFormErrors,
} from '@/components/common/DynamicForm';
import { FileUploader } from '@/components/common/FileUploader';
import { MobileHeader } from '@/components/common/MobileHeader';
import { Stepper } from '@/components/common/Stepper';
import { Button } from '@/components/ui/button';
import { catalogApi, type ServiceDto } from '@/lib/api/catalog';
import { requestsApi } from '@/lib/api/requests';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useRequestDraftStore } from '@/lib/stores/request-draft-store';
import { formatToman, toPersianDigits } from '@/lib/format';

/**
 * Request wizard (7.6) — 6 steps:
 *  1 service confirm → 2 dynamic form → 3 files → 4 contact → 5 review → 6 submit
 * Draft persists across navigation (request-draft store).
 */

const STEP_LABELS = ['خدمت', 'فرم', 'فایل', 'تماس', 'بازبینی'];

// Well-known contact method slugs (seeded server-side)
const CONTACT_METHODS = [
  { slug: 'phone', label: 'تماس تلفنی', icon: Phone },
  { slug: 'telegram', label: 'تلگرام', icon: Send },
  { slug: 'whatsapp', label: 'واتساپ', icon: MessageSquare },
  { slug: 'email', label: 'ایمیل', icon: User },
];

function WizardInner() {
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const draft = useRequestDraftStore();

  // 7.6.1 — service from query param wins over draft
  const serviceSlug = search.get('service');
  const service = useQuery({
    queryKey: ['service', serviceSlug],
    queryFn: () => catalogApi.service(serviceSlug as string),
    enabled: Boolean(serviceSlug),
  });

  useEffect(() => {
    if (service.data) {
      draft.setService({
        id: Number(service.data.id),
        slug: service.data.slug,
        name: service.data.name,
      });
    } else if (!serviceSlug && !draft.serviceId) {
      router.replace('/services');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.data]);

  const activeFields = useMemo(
    () => (service.data?.fields ?? []).filter((f) => f.active),
    [service.data],
  );

  const [formErrors, setFormErrors] = useState<DynamicFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  // 7.6.6 — submit with optimistic UI
  const submitMutation = useMutation({
    mutationFn: () =>
      requestsApi.create({
        serviceId: draft.serviceId!,
        formData: draft.formData,
        description: draft.description,
        contactMethod: draft.contactMethod,
        contactValue: draft.contactValue,
        fileIds: draft.fileIds,
      }),
    onSuccess: (created) => {
      setSubmittedCode(created.trackingCode);
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (e) => setSubmitError(e instanceof Error ? e.message : 'ثبت درخواست ناموفق بود'),
  });

  const step = draft.step;

  const goNext = () => {
    if (step === 2) {
      // Validate dynamic form client-side before advancing
      const errors = validateDynamicForm(activeFields, draft.formData);
      setFormErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }
    if (
      step === 4 &&
      draft.contactMethod &&
      !draft.contactValue &&
      draft.contactMethod !== 'phone'
    ) {
      // Contact value required for non-phone methods
      setFormErrors({ contactValue: 'مقدار تماس را وارد کنید' });
      return;
    }
    draft.setStep(Math.min(step + 1, 6));
  };

  const goBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    draft.setStep(step - 1);
  };

  // Step 6 success screen
  if (submittedCode) {
    return (
      <>
        <MobileHeader title="ثبت شد" showBell={false} />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-brand-100 mb-4 flex h-20 w-20 items-center justify-center rounded-full">
            <Check className="text-brand-700 h-10 w-10" />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900">درخواست شما ثبت شد!</h2>
          <p className="mt-2 text-sm text-gray-500">کد رهگیری:</p>
          <p
            dir="ltr"
            className="mt-1 rounded-xl bg-gray-100 px-4 py-2 font-mono text-base font-bold text-gray-900"
          >
            {submittedCode}
          </p>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-gray-400">
            وضعیت درخواست را می‌توانید از صفحه درخواست‌ها دنبال کنید. در صورت نیاز اپراتور با شما
            تماس می‌گیرد.
          </p>
          <div className="mt-8 flex w-full flex-col gap-2 px-6">
            <Button
              onClick={() => {
                draft.reset();
                router.push('/requests');
              }}
            >
              مشاهده درخواست‌ها
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                draft.reset();
                router.push('/home');
              }}
            >
              بازگشت به خانه
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <MobileHeader title="ثبت درخواست" showBack showBell={false} />
      <div className="pt-4">
        <Stepper steps={STEP_LABELS} current={Math.min(step, 5)} />

        {/* ============ STEP 1: service confirmation ============ */}
        {step === 1 && (
          <div className="mt-6 space-y-4">
            {service.isLoading ? (
              <div className="h-32 animate-pulse rounded-2xl bg-gray-200/80" />
            ) : service.data ? (
              <ServiceSummary service={service.data} />
            ) : draft.serviceName ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-700 shadow-sm">
                خدمت انتخاب‌شده: <b>{draft.serviceName}</b>
              </div>
            ) : null}
            <WizardNav onNext={goNext} nextLabel="تأیید خدمت" />
          </div>
        )}

        {/* ============ STEP 2: dynamic form ============ */}
        {step === 2 && (
          <div className="mt-6 space-y-4">
            {activeFields.length === 0 ? (
              <p className="rounded-2xl bg-gray-50 p-4 text-center text-xs text-gray-400">
                این خدمت فرم اطلاعاتی ندارد — مرحله بعد
              </p>
            ) : (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <DynamicForm
                  fields={activeFields}
                  values={draft.formData}
                  errors={formErrors}
                  onChange={(name, value) =>
                    draft.setFormData({ ...draft.formData, [name]: value })
                  }
                  renderFileField={(field, value, error) => (
                    <div>
                      <FileUploader
                        imagesOnly={field.type === 'image'}
                        fileIds={
                          Array.isArray(value) ? value.map(String) : value ? [String(value)] : []
                        }
                        onChange={(ids) =>
                          draft.setFormData({ ...draft.formData, [field.name]: ids[0] ?? '' })
                        }
                      />
                      {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
                    </div>
                  )}
                />
              </div>
            )}
            <WizardNav onBack={goBack} onNext={goNext} nextLabel="ادامه" />
          </div>
        )}

        {/* ============ STEP 3: file upload ============ */}
        {step === 3 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-1 text-sm font-bold text-gray-800">پیوست فایل‌ها</h3>
              <p className="mb-4 text-xs text-gray-400">
                {service.data?.requiresFile
                  ? 'برای این خدمت ارسال فایل الزامی است'
                  : 'در صورت نیاز، مدارک یا نمونه فایل را پیوست کنید (اختیاری)'}
              </p>
              <FileUploader fileIds={draft.fileIds} onChange={draft.setFileIds} maxFiles={10} />
            </div>
            <WizardNav
              onBack={goBack}
              onNext={goNext}
              nextLabel="ادامه"
              nextDisabled={service.data?.requiresFile && draft.fileIds.length === 0}
            />
          </div>
        )}

        {/* ============ STEP 4: contact method ============ */}
        {step === 4 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-gray-800">روش تماس مطلوب</h3>
              <div className="grid grid-cols-2 gap-2">
                {CONTACT_METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = draft.contactMethod === m.slug;
                  return (
                    <button
                      key={m.slug}
                      type="button"
                      onClick={() =>
                        draft.setContact(
                          m.slug,
                          m.slug === 'phone'
                            ? (user?.phone ?? draft.contactValue)
                            : draft.contactValue,
                        )
                      }
                      className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${
                        active
                          ? 'border-brand-600 bg-brand-50 text-brand-800'
                          : 'border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <label
                  htmlFor="contactValue"
                  className="mb-1.5 block text-xs font-medium text-gray-600"
                >
                  مقدار تماس (شماره/آیدی){' '}
                  {draft.contactMethod && draft.contactMethod !== 'phone' && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <input
                  id="contactValue"
                  dir="ltr"
                  className="focus:border-brand-500 focus:ring-brand-100 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
                  placeholder={
                    draft.contactMethod === 'phone' ? (user?.phone ?? '09xxxxxxxxx') : '@username'
                  }
                  value={draft.contactValue ?? ''}
                  onChange={(e) => draft.setContact(draft.contactMethod ?? 'phone', e.target.value)}
                />
                {formErrors.contactValue && (
                  <p className="mt-1 text-xs font-medium text-red-500">{formErrors.contactValue}</p>
                )}
                <p className="mt-1.5 text-[11px] text-gray-400">
                  اگر خالی بماند، اطلاعات پروفایل شما استفاده می‌شود
                </p>
              </div>
            </div>
            <WizardNav onBack={goBack} onNext={goNext} nextLabel="ادامه" />
          </div>
        )}

        {/* ============ STEP 5: review ============ */}
        {step === 5 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-gray-800">بازبینی درخواست</h3>
              <dl className="space-y-2.5 text-sm">
                <Row label="خدمت" value={draft.serviceName ?? '—'} />
                <Row
                  label="هزینه دستمزد"
                  value={service.data ? formatToman(service.data.laborFee) : '—'}
                />
                <Row
                  label="روش تماس"
                  value={CONTACT_METHODS.find((m) => m.slug === draft.contactMethod)?.label ?? '—'}
                />
                <Row
                  label="مقدار تماس"
                  value={draft.contactValue || user?.phone || 'پیش‌فرض پروفایل'}
                  dir="ltr"
                />
                <Row
                  label="فایل‌های پیوست"
                  value={`${toPersianDigits(draft.fileIds.length)} فایل`}
                />
                {Object.entries(draft.formData).filter(
                  ([, v]) => v !== '' && v !== null && (!Array.isArray(v) || v.length > 0),
                ).length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <dt className="mb-2 text-xs font-bold text-gray-500">اطلاعات فرم</dt>
                    <dd className="space-y-1.5">
                      {Object.entries(draft.formData)
                        .filter(
                          ([, v]) => v !== '' && v !== null && (!Array.isArray(v) || v.length > 0),
                        )
                        .map(([k, v]) => {
                          const field = activeFields.find((f) => f.name === k);
                          const label = field?.label ?? k;
                          const display = Array.isArray(v) ? v.join('، ') : String(v);
                          const option = field?.options?.find((o) => o.value === display);
                          return (
                            <div key={k} className="flex items-start justify-between gap-3 text-xs">
                              <span className="text-gray-400">{label}</span>
                              <span className="text-left font-medium text-gray-700">
                                {option?.label ?? display}
                              </span>
                            </div>
                          );
                        })}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-4">
                <label
                  htmlFor="description"
                  className="mb-1.5 block text-xs font-medium text-gray-600"
                >
                  توضیح تکمیلی (اختیاری)
                </label>
                <textarea
                  id="description"
                  className="focus:border-brand-500 focus:ring-brand-100 min-h-[72px] w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
                  value={draft.description ?? ''}
                  onChange={(e) => draft.setDescription(e.target.value)}
                  placeholder="هر نکته‌ای که اپراتور باید بداند…"
                />
              </div>
            </div>

            {submitError && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
                {submitError}
              </p>
            )}

            <WizardNav
              onBack={goBack}
              onNext={() => {
                setSubmitError(null);
                submitMutation.mutate();
              }}
              nextLabel={submitMutation.isPending ? 'در حال ثبت…' : 'ثبت نهایی درخواست'}
              nextDisabled={submitMutation.isPending}
              loading={submitMutation.isPending}
            />
          </div>
        )}
      </div>
    </>
  );
}

function ServiceSummary({ service }: { service: ServiceDto }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-brand-50 flex h-12 w-12 items-center justify-center rounded-xl text-xl">
          {service.icon ? <span aria-hidden>{service.icon}</span> : '📄'}
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{service.name}</h3>
          <p className="text-brand-700 mt-0.5 text-xs">{formatToman(service.laborFee)}</p>
        </div>
      </div>
      {service.description && (
        <p className="mt-3 border-t border-gray-50 pt-3 text-xs leading-relaxed text-gray-500">
          {service.description}
        </p>
      )}
    </div>
  );
}

function Row({ label, value, dir }: { label: string; value: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-gray-400">{label}</dt>
      <dd dir={dir} className="text-left font-medium text-gray-700">
        {value}
      </dd>
    </div>
  );
}

function WizardNav({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  loading,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pb-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold text-gray-600 active:bg-gray-50"
        >
          <ChevronRight className="h-4 w-4" />
          قبلی
        </button>
      )}
      <Button className="flex-1" onClick={onNext} disabled={nextDisabled || loading}>
        {loading && <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />}
        {nextLabel}
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="text-brand-600 h-6 w-6 animate-spin" />
        </div>
      }
    >
      <WizardInner />
    </Suspense>
  );
}
