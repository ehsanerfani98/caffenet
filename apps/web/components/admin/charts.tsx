'use client';

import { cn } from '@/lib/utils';
import { toPersianDigits } from '@/lib/format';

/**
 * Hand-rolled SVG charts (9.2.2) — no chart library (repo policy).
 *  - TrendChart: line + area, minimal axis labels (revenue trend)
 *  - DonutChart: stroke-dasharray segments + legend (requests by status)
 *  - BarList: horizontal bars with labels/values (top services)
 *  - RateRing: circular success-rate meter (payments)
 */

// ==================== TrendChart ====================

export function TrendChart({
  series,
  height = 180,
  colorClass = 'stroke-brand-500',
  fillClass = 'fill-brand-500/15',
  valueFormatter,
}: {
  series: Array<{ bucket: string; revenueToman: number }>;
  height?: number;
  colorClass?: string;
  fillClass?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (series.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-gray-400">
        داده‌ای برای نمایش وجود ندارد
      </div>
    );
  }

  const W = 600;
  const H = height;
  const PAD_X = 8;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 24;
  const values = series.map((s) => s.revenueToman);
  const max = Math.max(...values, 1);
  const stepX = series.length === 1 ? 0 : (W - PAD_X * 2) / (series.length - 1);

  const points = series.map((s, i) => {
    const x = PAD_X + i * stepX;
    const y = PAD_TOP + (1 - s.revenueToman / max) * (H - PAD_TOP - PAD_BOTTOM);
    return { x, y, ...s };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${points[points.length - 1]!.x.toFixed(1)},${H - PAD_BOTTOM} L${points[0]!.x.toFixed(1)},${H - PAD_BOTTOM} Z`;

  // Show at most 6 labels along the x axis
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div dir="ltr" className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="نمودار روند">
        {/* baseline grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_TOP + f * (H - PAD_TOP - PAD_BOTTOM)}
            y2={PAD_TOP + f * (H - PAD_TOP - PAD_BOTTOM)}
            className="stroke-gray-100"
            strokeWidth="1"
          />
        ))}
        <path d={areaPath} className={fillClass} />
        <path
          d={linePath}
          className={cn(colorClass, 'transition-all')}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" className="fill-brand-600" />
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`l-${i}`}
              x={p.x}
              y={H - 6}
              textAnchor="middle"
              className="fill-gray-400 text-[10px]"
            >
              {p.bucket.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      {valueFormatter && (
        <p className="mt-1 text-center text-[11px] text-gray-400">بیشینه: {valueFormatter(max)}</p>
      )}
    </div>
  );
}

// ==================== DonutChart ====================

const DONUT_COLORS = [
  '#16a34a',
  '#f59e0b',
  '#0ea5e9',
  '#a855f7',
  '#f97316',
  '#14b8a6',
  '#64748b',
  '#ef4444',
  '#8b5cf6',
];

export function DonutChart({
  segments,
  size = 160,
}: {
  segments: Array<{ label: string; value: number }>;
  size?: number;
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-gray-400">
        داده‌ای برای نمایش وجود ندارد
      </div>
    );
  }

  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
      <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="نمودار دایره‌ای">
        <g transform="translate(80,80) rotate(-90)">
          <circle r={R} fill="none" strokeWidth="20" className="stroke-gray-100" />
          {segments.map((s, i) => {
            const frac = s.value / total;
            const dash = `${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}`;
            const el = (
              <circle
                key={i}
                r={R}
                fill="none"
                strokeWidth="20"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += frac * C;
            return el;
          })}
        </g>
        <text x="80" y="76" textAnchor="middle" className="fill-gray-900 text-xl font-extrabold">
          {toPersianDigits(total)}
        </text>
        <text x="80" y="96" textAnchor="middle" className="fill-gray-400 text-[10px]">
          درخواست
        </text>
      </svg>
      <ul className="grid w-full max-w-[220px] grid-cols-1 gap-1.5 text-xs">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
              />
              <span className="truncate text-gray-600">{s.label}</span>
            </span>
            <span className="font-bold text-gray-800">{toPersianDigits(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ==================== BarList ====================

export function BarList({
  items,
  valueFormatter,
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
  valueFormatter?: (v: number) => string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-gray-400">
        داده‌ای برای نمایش وجود ندارد
      </div>
    );
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-medium text-gray-700">
              {it.label}
              {it.hint && <span className="mr-1.5 text-gray-400">({it.hint})</span>}
            </span>
            <span className="shrink-0 font-bold text-gray-800">
              {valueFormatter ? valueFormatter(it.value) : toPersianDigits(it.value)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="bg-brand-500 h-full rounded-full transition-all"
              style={{ width: `${Math.max(3, (it.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ==================== RateRing ====================

export function RateRing({ rate, label = 'نرخ موفقیت' }: { rate: number | null; label?: string }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const frac = rate === null ? 0 : Math.min(1, Math.max(0, rate / 100));
  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={label}>
        <g transform="translate(70,70) rotate(-90)">
          <circle r={R} fill="none" strokeWidth="14" className="stroke-gray-100" />
          <circle
            r={R}
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            className={
              rate === null
                ? 'stroke-gray-300'
                : frac >= 0.8
                  ? 'stroke-brand-500'
                  : frac >= 0.5
                    ? 'stroke-amber-500'
                    : 'stroke-red-500'
            }
            strokeDasharray={`${(frac * C).toFixed(2)} ${C.toFixed(2)}`}
          />
        </g>
        <text x="70" y="66" textAnchor="middle" className="fill-gray-900 text-2xl font-extrabold">
          {rate === null ? '—' : `${toPersianDigits(rate)}٪`}
        </text>
        <text x="70" y="88" textAnchor="middle" className="fill-gray-400 text-[10px]">
          {label}
        </text>
      </svg>
    </div>
  );
}
