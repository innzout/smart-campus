import type { ReactNode, HTMLAttributes } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // min-w-0 lets the card shrink inside a grid/flex track; without it the
        // default min-width:auto pins it to its content and the page scrolls sideways.
        'min-w-0 rounded-2xl border border-line bg-surface shadow-card',
        'transition-colors duration-200',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A card that fades/rises in — used for grid items so lists stagger naturally. */
export function MotionCard({
  className,
  children,
  delay = 0,
}: {
  className?: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn('min-w-0 rounded-2xl border border-line bg-surface shadow-card', className)}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] leading-tight font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="mt-1 text-[13px] text-ink-3">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  );
}
