import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Single-metric ring gauge — the hero figure for a percentage.
 *
 * The unfilled track is a lighter step of the fill's own ramp (per the meter
 * rule) so the state reads across the whole ring, and the value is always
 * printed in the centre in an ink token, never in the data color.
 */
export function RingGauge({
  value,
  label,
  sublabel,
  size = 168,
  thickness = 14,
  tone = 'brand',
  className,
}: {
  value: number;
  label?: string;
  sublabel?: string;
  size?: number;
  thickness?: number;
  tone?: 'brand' | 'good' | 'warning' | 'critical';
  className?: string;
}) {
  const ramps = {
    brand: { fill: 'var(--color-brand-500)', track: 'var(--color-brand-500)' },
    good: { fill: 'var(--color-good)', track: 'var(--color-good)' },
    warning: { fill: 'var(--color-warning)', track: 'var(--color-warning)' },
    critical: { fill: 'var(--color-critical)', track: 'var(--color-critical)' },
  };
  const ramp = ramps[tone];

  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? 'Value'}: ${clamped.toFixed(1)} percent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ramp.track}
          strokeWidth={thickness}
          opacity={0.16}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ramp.fill}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-semibold text-ink"
          style={{ fontSize: size * 0.24, lineHeight: 1 }}
        >
          {Math.round(clamped)}
          <span className="align-top" style={{ fontSize: size * 0.1 }}>
            %
          </span>
        </span>
        {label ? (
          <span className="mt-1.5 text-[11.5px] font-medium text-ink-2">{label}</span>
        ) : null}
        {sublabel ? <span className="text-[11px] text-ink-3">{sublabel}</span> : null}
      </div>
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Categorical ring — capped at three slices plus an "Other" fold, because the
 * all-pairs CVD floors only clear for the first three categorical slots.
 * Slices are separated by a 2px surface gap rather than a stroke.
 */
export function DonutChart({
  slices,
  size = 176,
  thickness = 22,
  centreValue,
  centreLabel,
  className,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centreValue?: string;
  centreLabel?: string;
  className?: string;
}) {
  const total = slices.reduce((t, s) => t + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const GAP = 2; // the surface gap, in px along the arc

  let consumed = 0;

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={slices.map((s) => `${s.label}: ${s.value}`).join(', ')}
    >
      <svg width={size} height={size} className="-rotate-90">
        {slices.map((slice) => {
          const fraction = slice.value / total;
          const arc = Math.max(0, circumference * fraction - GAP);
          const dashoffset = -consumed;
          consumed += circumference * fraction;
          if (slice.value <= 0) return null;
          return (
            <motion.circle
              key={slice.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth={thickness}
              strokeDasharray={`${arc} ${circumference - arc}`}
              initial={{ strokeDashoffset: 0, opacity: 0 }}
              animate={{ strokeDashoffset: dashoffset, opacity: 1 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
      </svg>
      {centreValue ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] leading-none font-semibold text-ink">{centreValue}</span>
          {centreLabel ? (
            <span className="mt-1 text-[11px] text-ink-3">{centreLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
