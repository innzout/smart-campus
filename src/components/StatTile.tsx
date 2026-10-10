import type { ComponentType, ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Sparkline } from './charts/Charts';
import { cn } from '@/lib/utils';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  /** Signed change vs a named period; the period name is required. */
  delta?: { value: number; period: string; upIsGood?: boolean };
  trend?: number[];
  tone?: 'neutral' | 'good' | 'warning' | 'critical';
  delay?: number;
  onClick?: () => void;
}

const TONE_ICON: Record<NonNullable<StatTileProps['tone']>, string> = {
  neutral: 'bg-brand-500/10 text-brand-600 dark:text-brand-300',
  good: 'bg-[#0ca30c]/12 text-[#0a7a0a] dark:text-[#4ade4a]',
  warning: 'bg-[#fab219]/16 text-[#8a5d00] dark:text-[#f5c451]',
  critical: 'bg-[#d03b3b]/12 text-[#a52424] dark:text-[#f08787]',
};

/**
 * Stat tile contract: label · value · optional delta · optional sparkline.
 * The value uses proportional figures (never tabular) because it stands alone.
 */
export function StatTile({
  label,
  value,
  note,
  icon: Icon,
  delta,
  trend,
  tone = 'neutral',
  delay = 0,
  onClick,
}: StatTileProps) {
  const up = (delta?.value ?? 0) >= 0;
  const good = delta ? (delta.upIsGood ?? true) === up : true;

  const Wrapper = onClick ? motion.button : motion.div;

  return (
    <Wrapper
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 text-left shadow-card',
        onClick &&
          'cursor-pointer transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-3">{label}</span>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', TONE_ICON[tone])}>
          <Icon className="size-[18px]" />
        </span>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="text-[28px] leading-none font-semibold tracking-tight text-ink">
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              'mb-0.5 inline-flex items-center gap-0.5 text-[12.5px] font-semibold',
              good ? 'text-[--delta-good]' : 'text-[--color-critical]',
            )}
          >
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta.value)}%
          </span>
        ) : null}
      </div>

      {note ? <p className="mt-2 text-[12.5px] text-ink-3">{note}</p> : null}
      {delta ? (
        <p className="mt-1 text-[11.5px] text-ink-3">vs {delta.period}</p>
      ) : null}

      {trend?.length ? (
        <div className="mt-3 -mb-1 overflow-hidden opacity-70 transition-opacity group-hover:opacity-100">
          <Sparkline data={trend} height={30} />
        </div>
      ) : null}
    </Wrapper>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
  );
}
