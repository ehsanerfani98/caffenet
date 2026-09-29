'use client';

import { OperatorRequestList } from '@/components/operator/OperatorRequestList';

/**
 * Request Queue (8.3) — every request in the system (scope=all).
 * Status tabs + search + sort («طولانی‌ترین انتظار») + self-assign cards.
 */
export default function OperatorQueuePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">صف درخواست‌ها</h2>
        <p className="mt-0.5 text-xs text-gray-400">
          همه درخواست‌های ثبت‌شده — با «تخصیص به من» هر مورد را به خودتان اختصاص دهید.
        </p>
      </div>

      <OperatorRequestList
        scope="all"
        showAssign
        emptyTitle="درخواستی یافت نشد"
        emptyDescription="با تغییر فیلتر وضعیت یا عبارت جستجو دوباره تلاش کنید."
      />
    </div>
  );
}
