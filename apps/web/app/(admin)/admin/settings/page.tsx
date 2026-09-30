'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/common/Skeleton';
import { toast } from '@/components/ui/use-toast';
import { adminSettingsApi, type SettingEntryDto, type SettingsSections } from '@/lib/api/admin';
import { formatJalaliDateTime } from '@/lib/format';

/**
 * Settings admin (9.12.1–9.12.8) — sections as cards rendered from
 * GET /admin/settings; inputs per type (boolean → toggle, json → textarea);
 * secrets masked with a «تغییر» reveal (empty = unchanged on save);
 * save per section.
 */

const SECTION_META: Record<string, { title: string; description: string }> = {
  general: {
    title: 'عمومی',
    description: 'نام سامانه، لوگو، ارز، اطلاعات تماس و آدرس‌های پایه',
  },
  notifications: {
    title: 'اعلان‌ها',
    description: 'کانال‌های فعال اعلان (SMS، ایمیل، درون‌برنامه‌ای)',
  },
  payment: {
    title: 'درگاه پرداخت',
    description: 'فعال‌سازی درگاه‌ها، کلیدهای merchant و حالت آزمایشی',
  },
  pusher: { title: 'Pusher', description: 'تنظیمات Real-time (چت و اعلان لحظه‌ای)' },
  push: { title: 'وب‌پوش (Web Push)', description: 'کلیدهای VAPID برای نوتیفیکیشن مرورگر' },
  mail: { title: 'ایمیل (SMTP)', description: 'تنظیمات ارسال ایمیل — درایور کنسول یا SMTP' },
  pwa: { title: 'PWA', description: 'نام، تم رنگی و آیکن‌های اپلیکیشن' },
  files: { title: 'فایل‌ها', description: 'حداکثر حجم و پسوندهای مجاز آپلود' },
  requests: { title: 'درخواست‌ها', description: 'استراتژی تخصیص خودکار و تأیید خودکار' },
  sms: { title: 'SMS', description: 'سرویس‌دهنده پیامک، کلید API و الگوی OTP' },
};

const KEY_FA: Record<string, string> = {
  'system.name': 'نام سامانه',
  'system.name_fa': 'نام فارسی سامانه',
  'system.description': 'توضیح کوتاه',
  'system.logo_url': 'آدرس لوگو',
  'system.currency': 'واحد پول',
  'system.timezone': 'منطقه زمانی',
  'system.contact_phone': 'تلفن تماس',
  'system.contact_email': 'ایمیل تماس',
  'app.url': 'آدرس پایه API',
  'app.frontend_url': 'آدرس پایه وب‌اپ',
  'notifications.sms_enabled': 'پیامک فعال باشد؟',
  'notifications.email_enabled': 'ایمیل فعال باشد؟',
  'notifications.inapp_enabled': 'اعلان درون‌برنامه‌ای فعال باشد؟',
  'payments.zarinpal_enabled': 'زرین‌پال فعال باشد؟',
  'payments.zibal_enabled': 'زیبال فعال باشد؟',
  'payments.default_gateway': 'درگاه پیش‌فرض',
  'payments.zarinpal_merchant_id': 'Merchant ID زرین‌پال',
  'payments.zarinpal_sandbox': 'حالت آزمایشی زرین‌پال',
  'payments.zibal_merchant_id': 'Merchant ID زیبال',
  'payments.zibal_sandbox': 'حالت آزمایشی زیبال',
  'pusher.enabled': 'Pusher فعال باشد؟',
  'pusher.cluster': 'کلاستر',
  'pusher.app_id': 'App ID',
  'pusher.key': 'Key',
  'pusher.secret': 'Secret',
  'push.enabled': 'وب‌پوش فعال باشد؟',
  'push.vapid_public_key': 'کلید عمومی VAPID',
  'push.vapid_private_key': 'کلید خصوصی VAPID',
  'push.vapid_subject': 'Subject (mailto: یا آدرس سایت)',
  'mail.enabled': 'ارسال ایمیل فعال باشد؟',
  'mail.driver': 'درایور (console یا smtp)',
  'mail.host': 'هاست SMTP',
  'mail.port': 'پورت SMTP',
  'mail.user': 'نام کاربری SMTP',
  'mail.pass': 'رمز عبور SMTP',
  'mail.from': 'فرستنده پیش‌فرض',
  'pwa.theme_color': 'رنگ تم',
  'pwa.background_color': 'رنگ پس‌زمینه اسپلش',
  'pwa.icon_192': 'آیکن ۱۹۲',
  'pwa.icon_512': 'آیکن ۵۱۲',
  'pwa.app_name': 'نام اپلیکیشن',
  'pwa.short_name': 'نام کوتاه اپلیکیشن',
  'pwa.description': 'توضیح اپلیکیشن',
  'files.max_size_mb': 'حداکثر حجم (مگابایت)',
  'files.allowed_extensions': 'پسوندهای مجاز',
  'requests.auto_assign_strategy': 'استراتژی تخصیص خودکار',
  'requests.auto_approve': 'تأیید خودکار درخواست؟',
  'sms.provider': 'سرویس‌دهنده پیامک (ipanel / console)',
  'sms.ipanel_api_key': 'API Key آی‌پنل',
  'sms.ipanel_sender': 'شماره فرستنده آی‌پنل',
  'sms.ipanel_otp_pattern_code': 'کد الگوی OTP',
  'sms.ipanel_otp_param_name': 'نام پارامتر کد OTP',
  'sms.sender_number': 'شماره فرستنده',
};

function keyLabel(key: string): string {
  return KEY_FA[key] ?? key;
}

/** Per-section local editor state. */
interface SectionState {
  values: Record<string, string>;
  jsonText: Record<string, string>;
  revealed: Set<string>;
}

function initSection(entries: SettingEntryDto[]): SectionState {
  const values: Record<string, string> = {};
  const jsonText: Record<string, string> = {};
  for (const e of entries) {
    if (e.type === 'json' || e.valueJson !== null) {
      jsonText[e.key] = e.valueJson ? JSON.stringify(e.valueJson, null, 2) : '';
    } else {
      values[e.key] = e.isSecret ? '' : (e.value ?? '');
    }
  }
  return { values, jsonText, revealed: new Set() };
}

function SettingsSectionCard({
  section,
  entries,
}: {
  section: string;
  entries: SettingEntryDto[];
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SectionState>(() => initSection(entries));

  // Re-seed when the section data changes after save/refetch
  useEffect(() => {
    setState(initSection(entries));
  }, [entries]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Array<{ key: string; value?: string; valueJson?: unknown }> = [];
      for (const e of entries) {
        if (e.type === 'json' || e.valueJson !== null) {
          const text = state.jsonText[e.key] ?? '';
          if (text.trim().length === 0) continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(text);
          } catch {
            throw new Error(`مقدار JSON برای «${keyLabel(e.key)}» نامعتبر است`);
          }
          payload.push({ key: e.key, valueJson: parsed });
        } else if (e.isSecret) {
          const v = state.values[e.key] ?? '';
          if (v.length > 0 && state.revealed.has(e.key)) {
            payload.push({ key: e.key, value: v });
          }
        } else {
          const v = state.values[e.key] ?? '';
          if (v === (e.value ?? '')) continue; // unchanged
          payload.push({ key: e.key, value: v });
        }
      }
      if (payload.length === 0) throw new Error('تغییری برای ذخیره وجود ندارد');
      return adminSettingsApi.update(payload);
    },
    onSuccess: () => {
      toast({ title: 'تنظیمات ذخیره شد' });
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (e) => toast({ title: 'ذخیره ناموفق بود', description: e.message }),
  });

  const meta = SECTION_META[section] ?? { title: section, description: '' };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-extrabold text-gray-900">{meta.title}</h2>
        <p className="mt-0.5 text-[11px] text-gray-400">{meta.description}</p>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {entries.map((e) => {
          const isJson = e.type === 'json' || e.valueJson !== null;
          return (
            <div key={e.key} className="rounded-xl border border-gray-100 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-700">{keyLabel(e.key)}</span>
                <span dir="ltr" className="text-[10px] text-gray-300">
                  {e.key}
                </span>
              </div>
              {e.description && <p className="mb-2 text-[11px] text-gray-400">{e.description}</p>}

              {e.type === 'boolean' ? (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(state.values[e.key] ?? e.value ?? 'false') === 'true'}
                    onChange={(ev) =>
                      setState((s) => ({
                        ...s,
                        values: { ...s.values, [e.key]: ev.target.checked ? 'true' : 'false' },
                      }))
                    }
                    className="accent-brand-600 h-4 w-4"
                  />
                  <span className="text-[11px] font-bold text-gray-600">
                    {(state.values[e.key] ?? e.value ?? 'false') === 'true' ? 'فعال' : 'غیرفعال'}
                  </span>
                </label>
              ) : isJson ? (
                <textarea
                  dir="ltr"
                  rows={3}
                  value={state.jsonText[e.key] ?? ''}
                  onChange={(ev) =>
                    setState((s) => ({
                      ...s,
                      jsonText: { ...s.jsonText, [e.key]: ev.target.value },
                    }))
                  }
                  placeholder='{"key": "value"}'
                  className="focus:border-brand-400 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs outline-none focus:bg-white"
                />
              ) : e.isSecret ? (
                <div className="flex items-center gap-2">
                  {state.revealed.has(e.key) ? (
                    <>
                      <input
                        dir="ltr"
                        type="text"
                        value={state.values[e.key] ?? ''}
                        onChange={(ev) =>
                          setState((s) => ({
                            ...s,
                            values: { ...s.values, [e.key]: ev.target.value },
                          }))
                        }
                        placeholder="مقدار جدید (خالی = بدون تغییر)"
                        className="focus:border-brand-400 flex-1 rounded-lg border border-amber-300 bg-amber-50/50 px-3 py-2 font-mono text-xs outline-none"
                      />
                      <button
                        type="button"
                        aria-label="پنهان‌سازی"
                        onClick={() =>
                          setState((s) => {
                            const revealed = new Set(s.revealed);
                            revealed.delete(e.key);
                            return { ...s, revealed, values: { ...s.values, [e.key]: '' } };
                          })
                        }
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                      >
                        <EyeOff className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-500">
                        {e.hasValue ? (e.value ?? '••••••••') : '— تنظیم نشده —'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setState((s) => {
                            const revealed = new Set(s.revealed);
                            revealed.add(e.key);
                            return { ...s, revealed, values: { ...s.values, [e.key]: '' } };
                          })
                        }
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        تغییر
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <input
                  dir="ltr"
                  value={state.values[e.key] ?? ''}
                  onChange={(ev) =>
                    setState((s) => ({ ...s, values: { ...s.values, [e.key]: ev.target.value } }))
                  }
                  className="focus:border-brand-400 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:bg-white"
                />
              )}

              {e.updatedAt && (
                <p className="mt-1.5 text-[10px] text-gray-300">
                  آخرین تغییر: {formatJalaliDateTime(e.updatedAt)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-100 px-4 py-3 sm:px-5">
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="bg-brand-500 hover:bg-brand-600 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره این بخش'}
        </button>
      </div>
    </section>
  );
}

export default function AdminSettingsPage() {
  const settings = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminSettingsApi.get,
  });

  const sections = settings.data ?? {};

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="تنظیمات"
        description="پیکربندی سامانه — هر بخش به‌صورت مستقل ذخیره می‌شود"
      />

      {settings.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : settings.isError ? (
        <ErrorState title="خطا در دریافت تنظیمات" onRetry={() => settings.refetch()} />
      ) : (
        (Object.keys(SECTION_META) as Array<keyof typeof SECTION_META>).map((section) => {
          const entries = (sections as SettingsSections)[section];
          if (!entries || entries.length === 0) {
            return (
              <section
                key={section}
                className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-6"
              >
                <h2 className="text-sm font-extrabold text-gray-700">
                  {SECTION_META[section]?.title ?? section}
                </h2>
                <p className="mt-1 text-[11px] text-gray-400">
                  تنظیمی برای این بخش تعریف نشده است.
                </p>
              </section>
            );
          }
          return <SettingsSectionCard key={section} section={section} entries={entries} />;
        })
      )}
    </div>
  );
}
