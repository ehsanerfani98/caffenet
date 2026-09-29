'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { catalogApi } from '@/lib/api/catalog';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { MobileHeader } from '@/components/common/MobileHeader';
import { formatToman, toPersianDigits } from '@/lib/format';

/**
 * Service detail page (7.5.3) — info + fields preview → start request wizard.
 */
export default function ServiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const service = useQuery({
    queryKey: ['service', slug],
    queryFn: () => catalogApi.service(slug as string),
    enabled: Boolean(slug),
  });

  if (service.isLoading) {
    return (
      <>
        <MobileHeader title="خدمت" showBack showBell={false} />
        <DetailSkeleton />
      </>
    );
  }

  if (service.isError || !service.data) {
    return (
      <>
        <MobileHeader title="خدمت" showBack showBell={false} />
        <ErrorState title="خدمت یافت نشد" onRetry={() => service.refetch()} />
      </>
    );
  }

  const s = service.data;

  return (
    <>
      <MobileHeader title={s.name} showBack showBell={false} />
      <div className="space-y-5 pt-4">
        {/* Hero */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="bg-brand-50 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl">
              {s.icon ? (
                <span aria-hidden>{s.icon}</span>
              ) : (
                <FileText className="text-brand-600 h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-extrabold text-gray-900">{s.name}</h1>
              {s.category && <p className="mt-0.5 text-xs text-gray-400">{s.category.name}</p>}
            </div>
          </div>

          {s.description && (
            <p className="mt-4 text-sm leading-relaxed text-gray-600">{s.description}</p>
          )}

          <dl className="mt-5 space-y-2.5 border-t border-gray-100 pt-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">دستمزد خدمت</dt>
              <dd className="text-brand-700 font-extrabold">{formatToman(s.laborFee)}</dd>
            </div>
            {s.estimatedDurationMin ? (
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1 text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  زمان تقریبی
                </dt>
                <dd className="text-gray-700">~{toPersianDigits(s.estimatedDurationMin)} دقیقه</dd>
              </div>
            ) : null}
            {s.requiresFile && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">پیوست فایل</dt>
                <dd className="text-gray-700">الزامی</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Dynamic form fields preview */}
        {s.fields && s.fields.length > 0 && (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-gray-800">اطلاعات موردنیاز</h2>
            <ul className="space-y-2 text-xs text-gray-500">
              {s.fields
                .filter((f) => f.active)
                .map((f) => (
                  <li key={f.id} className="flex items-start gap-2">
                    <span className="bg-brand-400 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                    <span>
                      {f.label}
                      {f.required && <span className="mr-1 text-red-400">*</span>}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        <div className="bg-brand-50/70 text-brand-800 rounded-2xl p-4 text-xs leading-relaxed">
          <p className="flex items-center gap-1.5 font-bold">
            <ShieldCheck className="h-4 w-4" />
            پرداخت امن
          </p>
          <p className="text-brand-700/80 mt-1">
            هزینه پس از بررسی اپراتور و تأیید نهایی محاسبه می‌شود؛ پرداخت با کیف پول یا درگاه بانکی.
          </p>
        </div>

        {/* Sticky CTA */}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30">
          <button
            type="button"
            onClick={() => router.push(`/requests/new?service=${s.slug}`)}
            className="bg-brand-600 shadow-brand-600/25 active:bg-brand-700 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-extrabold text-white shadow-xl"
          >
            ثبت درخواست
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>

        {service.isFetching && <Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-300" />}
      </div>
    </>
  );
}
