import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn, initials } from '@/lib/utils';

/* ── Avatar ────────────────────────────────────────────────────────────── */

export function Avatar({
  name,
  hue = 250,
  size = 'md',
  className,
}: {
  name: string;
  hue?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    xs: 'size-6 text-[10px]',
    sm: 'size-8 text-[11px]',
    md: 'size-10 text-[13px]',
    lg: 'size-14 text-lg',
  };
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold text-white select-none',
        'ring-2 ring-surface',
        sizes[size],
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 68% 54%), hsl(${(hue + 40) % 360} 62% 44%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

/* ── Progress / meter ──────────────────────────────────────────────────── */

export function Progress({
  value,
  tone = 'brand',
  className,
  label,
}: {
  value: number;
  tone?: 'brand' | 'good' | 'warning' | 'critical';
  className?: string;
  label?: string;
}) {
  const colors = {
    brand: 'var(--color-brand-500)',
    good: 'var(--color-good)',
    warning: 'var(--color-warning)',
    critical: 'var(--color-critical)',
  };
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        className="h-full rounded-full"
        style={{ background: colors[tone] }}
      />
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-ink-3">
        {icon}
      </div>
      <p className="mt-4 text-[15px] font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ── Segmented control ─────────────────────────────────────────────────── */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  // Derived from the option values, two Segmenteds with the same options would
  // share a layoutId and fight over one indicator. useId keeps each instance
  // isolated even when two pages overlap during a transition.
  const indicatorId = useId();
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative rounded-lg font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${indicatorId}`}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-line"
              />
            ) : null}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────────── */

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('skeleton rounded-lg', className)} />
);

/* ── Section heading inside a page ─────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  action,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]"
        >
          {title}
        </motion.h1>
        {subtitle ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="mt-1.5 text-sm text-ink-3"
          >
            {subtitle}
          </motion.p>
        ) : null}
        {children}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}
