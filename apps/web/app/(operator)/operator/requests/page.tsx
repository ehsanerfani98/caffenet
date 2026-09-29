'use client';

import { OperatorRequestList } from '@/components/operator/OperatorRequestList';

/**
 * My Requests (8.1.3) — requests assigned to the current operator
 * (scope=mine), same list engine as the queue without the assign action.
 */
export default function OperatorMyRequestsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">درخواست‌های من</h2>
        <p className="mt-0.5 text-xs text-gray-400">
          درخواست‌هایی که به شما تخصیص یافته‌اند و در جریان رسیدگی هستند.
        </p>
      </div>

      <OperatorRequestList
        scope="mine"
        emptyTitle="درخواستی به شما تخصیص نیافته"
        emptyDescription="از داشبورد، «برداشتن مورد بعدی از صف» را بزنید یا از صف درخواست‌ها موردی را تخصیص دهید."
      />
    </div>
  );
}
