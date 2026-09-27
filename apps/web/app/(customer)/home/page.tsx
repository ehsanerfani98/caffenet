export default function CustomerHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">سلام، خوش آمدید! 👋</h1>
      <p className="text-gray-600 mb-6">
        به سامانه خدمات کافی‌نت. این صفحه در Phase 7 پیاده‌سازی می‌شود.
      </p>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-2">وضعیت سیستم</h2>
        <p className="text-sm text-gray-600">
          Phase 1 (Foundation) فعال است. صفحات مشتری در Phase 7 آماده خواهند شد.
        </p>
      </div>
    </div>
  );
}
