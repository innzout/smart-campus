import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Categorical slots, in fixed order. Never cycled — a chart that would need a
 * 4th+ slot folds into "Other" or facets instead. Both light and dark steps are
 * declared in index.css and validated against the real card surfaces.
 */
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'] as const;

/** Status colors are reserved and never reused as a series color. */
export const STATUS = {
  good: 'var(--color-good)',
  warning: 'var(--color-warning)',
  serious: 'var(--color-serious)',
  critical: 'var(--color-critical)',
} as const;

export const CHART_INK = {
  grid: 'var(--grid-line)',
  axis: 'var(--axis-line)',
  muted: 'var(--ink-3)',
  primary: 'var(--ink)',
  secondary: 'var(--ink-2)',
  surface: 'var(--surface)',
};

/** Shared tooltip shell — chart chrome, so it wears text tokens, not data colors. */
export function TooltipShell({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="pointer-events-none min-w-[9rem] rounded-xl border border-line bg-surface px-3 py-2.5 shadow-pop">
      <p className="mb-1.5 text-[12px] font-semibold text-ink">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function TooltipRow({
  color,
  label,
  value,
}: {
  color?: string;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      {color ? (
        <span
          className="size-2 shrink-0 rounded-full ring-2 ring-[--surface]"
          style={{ background: color }}
        />
      ) : null}
      <span className="text-ink-3">{label}</span>
      <span className="tnum ml-auto font-semibold text-ink">{value}</span>
    </div>
  );
}

/**
 * The dependable identity channel. Always rendered for two or more series so
 * nothing depends on color-matching alone.
 */
export function Legend({
  items,
  className,
}: {
  items: { color: string; label: string }[];
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[12px] text-ink-2">
          <span
            className="size-2.5 rounded-[3px]"
            style={{ background: item.color }}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The table view that backs every chart — the relief for the sub-3:1 light-mode
 * hues and the fallback when color fails entirely.
 */
export function ChartTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c, i) => (
              <th
                key={c}
                className={cn(
                  'pb-2 font-medium text-ink-3',
                  i > 0 && 'text-right',
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-line/60 last:border-0">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    'py-2',
                    ci === 0 ? 'font-medium text-ink' : 'tnum text-right text-ink-2',
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
