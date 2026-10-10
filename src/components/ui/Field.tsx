import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

const CONTROL = [
  'w-full rounded-xl border bg-surface px-3.5 text-sm text-ink',
  'placeholder:text-ink-3/80',
  'transition-[border-color,box-shadow,background-color] duration-150',
  'hover:border-line-strong',
  'focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3',
].join(' ');

const invalidRing =
  'border-[--color-critical] focus:border-[--color-critical] focus:ring-[--color-critical]/15';

/** Label + control + inline error. Errors announce themselves to screen readers. */
export function Field({
  label,
  error,
  hint,
  required,
  children,
  htmlFor,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-[13px] font-medium text-ink-2"
      >
        {label}
        {required ? (
          <span className="text-[--color-critical]" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      <AnimatePresence mode="wait" initial={false}>
        {error ? (
          <motion.p
            key="err"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-[--color-critical]"
          >
            <AlertCircle className="size-3.5 shrink-0" aria-hidden />
            {error}
          </motion.p>
        ) : hint ? (
          <p className="text-[12.5px] text-ink-3">{hint}</p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; leading?: ReactNode }
>(function Input({ className, invalid, leading, ...props }, ref) {
  if (leading) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3">
          {leading}
        </span>
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(CONTROL, 'h-11 pl-10', invalid && invalidRing, className)}
          {...props}
        />
      </div>
    );
  }
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, 'h-11', invalid && invalidRing, className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, 'resize-y py-2.5 leading-relaxed', invalid && invalidRing, className)}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL,
          'h-11 cursor-pointer appearance-none pr-10',
          invalid && invalidRing,
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
    </div>
  );
});

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = useId();
  return (
    <label
      htmlFor={props.id ?? id}
      className={cn('flex cursor-pointer items-center gap-2.5 text-sm text-ink-2', className)}
    >
      <input
        id={props.id ?? id}
        type="checkbox"
        className="size-4 cursor-pointer rounded border-line-strong accent-brand-600"
        {...props}
      />
      {label}
    </label>
  );
}
