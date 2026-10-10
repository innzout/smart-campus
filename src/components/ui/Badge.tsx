import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'brand' | 'good' | 'warning' | 'serious' | 'critical' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2 ring-line',
  brand: 'bg-brand-500/12 text-brand-600 ring-brand-500/25 dark:text-brand-300',
  good: 'bg-[#0ca30c]/12 text-[#0a7a0a] ring-[#0ca30c]/30 dark:text-[#4ade4a]',
  warning: 'bg-[#fab219]/16 text-[#8a5d00] ring-[#fab219]/35 dark:text-[#f5c451]',
  serious: 'bg-[#ec835a]/16 text-[#a2451f] ring-[#ec835a]/35 dark:text-[#f0a184]',
  critical: 'bg-[#d03b3b]/12 text-[#a52424] ring-[#d03b3b]/30 dark:text-[#f08787]',
  info: 'bg-[#2a78d6]/12 text-[#1c5cab] ring-[#2a78d6]/28 dark:text-[#7db4f0]',
};

export function Badge({
  tone = 'neutral',
  children,
  icon,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'text-[11px] font-semibold tracking-wide whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * Status is never carried by color alone — every pill ships an icon and a label,
 * so it survives colorblindness, grayscale print and forced-colors.
 */
export function StatusPill({
  status,
  className,
}: {
  status:
    | 'paid' | 'partial' | 'due'
    | 'submitted' | 'graded' | 'overdue' | 'due-soon' | 'pending'
    | 'open' | 'in-progress' | 'resolved'
    | 'active' | 'inactive'
    | 'good' | 'at-risk'
    | 'available' | 'borrowed' | 'returned';
  className?: string;
}) {
  const map: Record<string, { tone: Tone; label: string; icon: ReactNode }> = {
    paid: { tone: 'good', label: 'Paid', icon: <CheckCircle2 className="size-3.5" /> },
    partial: { tone: 'warning', label: 'Partial', icon: <Clock className="size-3.5" /> },
    due: { tone: 'critical', label: 'Due', icon: <AlertTriangle className="size-3.5" /> },

    submitted: { tone: 'info', label: 'Submitted', icon: <CheckCircle2 className="size-3.5" /> },
    graded: { tone: 'good', label: 'Graded', icon: <CheckCircle2 className="size-3.5" /> },
    overdue: { tone: 'critical', label: 'Overdue', icon: <XCircle className="size-3.5" /> },
    'due-soon': { tone: 'warning', label: 'Due soon', icon: <Clock className="size-3.5" /> },
    pending: { tone: 'neutral', label: 'Pending', icon: <CircleDashed className="size-3.5" /> },

    open: { tone: 'warning', label: 'Open', icon: <CircleDashed className="size-3.5" /> },
    'in-progress': { tone: 'info', label: 'In progress', icon: <Clock className="size-3.5" /> },
    resolved: { tone: 'good', label: 'Resolved', icon: <CheckCircle2 className="size-3.5" /> },

    active: { tone: 'good', label: 'Active', icon: <CheckCircle2 className="size-3.5" /> },
    inactive: { tone: 'neutral', label: 'Inactive', icon: <CircleDashed className="size-3.5" /> },

    good: { tone: 'good', label: 'Good', icon: <CheckCircle2 className="size-3.5" /> },
    'at-risk': { tone: 'critical', label: 'At risk', icon: <AlertTriangle className="size-3.5" /> },

    available: { tone: 'good', label: 'Available', icon: <CheckCircle2 className="size-3.5" /> },
    borrowed: { tone: 'warning', label: 'Borrowed', icon: <Clock className="size-3.5" /> },
    returned: { tone: 'neutral', label: 'Returned', icon: <CheckCircle2 className="size-3.5" /> },
  };

  const cfg = map[status] ?? map.pending!;
  return (
    <Badge tone={cfg.tone} icon={cfg.icon} className={className}>
      {cfg.label}
    </Badge>
  );
}
