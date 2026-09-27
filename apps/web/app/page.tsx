import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/common/BottomNavigation';

export default function HomePage() {
  return (
    <main className="container-mobile pb-bottom-nav">
      <header className="safe-area-top pt-4 pb-6">
        <h1 className="text-3xl font-bold text-gray-900">سلام، خوش آمدید!</h1>
        <p className="text-gray-500 mt-1">به سامانه خدمات کافی‌نت</p>
      </header>

      <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-4">سامانه در حال راه‌اندازی است</h2>
        <p className="text-gray-600 mb-4 text-sm leading-6">
          این نسخه Phase 1 از سامانه Caffenet است. ساختار پایه، دیتابیس و API آماده است.
          صفحات مشتری، اپراتور و ادمین در فازهای بعدی پیاده‌سازی خواهند شد.
        </p>
        <Button variant="default" asChild>
          <a href="/api/v1/health" target="_blank" rel="noreferrer">
            بررسی سلامت API
          </a>
        </Button>
      </section>

      <BottomNavigation />
    </main>
  );
}
