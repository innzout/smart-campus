import { useState } from 'react';
import { toast } from 'sonner';
import { Banknote, CheckCircle2, CreditCard, Printer, Receipt, Smartphone } from 'lucide-react';
import { useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { sectionLabel, feeSummary } from '@/lib/queries';
import { payFee } from '@/lib/actions';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/misc';
import { cn, formatDate, money, todayISO } from '@/lib/utils';
import type { User } from '@/data/types';

const METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'cheque', label: 'Cheque', icon: Receipt },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'card', label: 'Card', icon: CreditCard },
] as const;

type Method = (typeof METHODS)[number]['value'];

/**
 * Recording a payment taken at the office counter.
 *
 * Most parents at an Indian school pay here rather than online, so this is the
 * clerk's daily screen — pick the head, take the money, hand over a receipt.
 */
export function CollectFeeDialog({ student, onClose }: { student: User; onClose: () => void }) {
  // The receipt records who took the money, which is the point of a counter.
  const me = useCurrentUser();
  const db = useDatabase();
  const summary = feeSummary(db, student.id);
  const outstanding = summary.rows.filter((f) => f.paid < f.total);

  const [feeId, setFeeId] = useState(outstanding[0]?.id ?? '');
  const fee = outstanding.find((f) => f.id === feeId);
  const due = fee ? fee.total - fee.paid : 0;

  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState<Method>('cash');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{ receiptNo: string; amount: number } | null>(null);

  // Switching head resets the amount to that head's balance — the common case
  // is taking the full outstanding for one item.
  const pickFee = (id: string) => {
    setFeeId(id);
    const next = outstanding.find((f) => f.id === id);
    setAmount(String(next ? next.total - next.paid : 0));
    setError('');
  };

  const record = () => {
    if (!fee) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the amount received.');
      return;
    }
    if (value > due) {
      setError(`That is more than the ${money(due)} outstanding on this head.`);
      return;
    }
    // payFee returns the receipt number it allotted.
    const receiptNo = payFee({ feeId: fee.id, amount: value, method, collectedById: me.id });
    setReceipt({ receiptNo, amount: value });
    toast.success('Payment recorded', { description: `Receipt ${receiptNo}` });
  };

  if (receipt) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Payment recorded"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              icon={<Printer className="size-4" />}
              onClick={() => toast.info('Receipt printing is simulated in this demo.')}
            >
              Print receipt
            </Button>
            <Button onClick={onClose}>Done</Button>
          </>
        }
      >
        <div className="flex flex-col items-center py-2 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-[--color-good]/12 text-[--color-good]">
            <CheckCircle2 className="size-7" />
          </span>
          <p className="mt-4 text-[26px] font-semibold text-ink">{money(receipt.amount)}</p>
          <p className="mt-1 text-[13px] text-ink-3">{fee?.head}</p>

          <dl className="mt-6 w-full space-y-2.5 rounded-xl bg-surface-2 px-4 py-3.5 text-left text-[12.5px]">
            {[
              ['Receipt no.', receipt.receiptNo],
              ['Student', `${student.name} · ${sectionLabel(db, student.sectionId)}`],
              ['Admission no.', student.registerNo ?? '—'],
              ['Method', method.toUpperCase()],
              ['Collected on', formatDate(todayISO())],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-ink-3">{k}</dt>
                <dd className="font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11.5px] text-ink-3">
            The parent is notified in the app as soon as this is saved.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Collect fee at the counter"
      description={`${student.name} · ${sectionLabel(db, student.sectionId)} · ${student.registerNo}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!fee} onClick={record}>
            Record payment
          </Button>
        </>
      }
    >
      {outstanding.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-6" />}
          title="Nothing outstanding"
          description="All fees for this student are cleared."
        />
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-2">Which fee?</p>
            <div className="space-y-2">
              {outstanding.map((f) => (
                <label
                  key={f.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                    feeId === f.id
                      ? 'border-brand-500/50 bg-brand-500/[0.07]'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <input
                    type="radio"
                    name="fee-head"
                    checked={feeId === f.id}
                    onChange={() => pickFee(f.id)}
                    className="size-4 shrink-0 accent-brand-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{f.head}</span>
                    <span className="block text-[11.5px] text-ink-3">Due {formatDate(f.dueOn)}</span>
                  </span>
                  <span className="tnum shrink-0 text-[13px] font-semibold text-[--color-critical]">
                    {money(f.total - f.paid)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Field label="Amount received" error={error} required htmlFor="collect-amount">
            <Input
              id="collect-amount"
              type="number"
              min={1}
              max={due}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              invalid={!!error}
            />
          </Field>

          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-2">How was it paid?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METHODS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={cn(
                    'rounded-xl border px-3 py-3 text-left transition-colors',
                    method === value
                      ? 'border-brand-500/50 bg-brand-500/[0.07]'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4',
                      method === value ? 'text-brand-600 dark:text-brand-300' : 'text-ink-3',
                    )}
                  />
                  <span className="mt-1.5 block text-[12.5px] font-semibold text-ink">{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </Modal>
  );
}
