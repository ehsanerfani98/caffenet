import { cn } from '@/lib/utils';
import { requestStatusLabel, statusColorClass } from '@/lib/status-meta';

/**
 * Status badge — Persian label + soft colors for any request/invoice status.
 */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        statusColorClass(status),
        className,
      )}
    >
      {requestStatusLabel(status)}
    </span>
  );
}
