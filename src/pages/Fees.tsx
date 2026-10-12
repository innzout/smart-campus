import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Landmark,
  Receipt,
  Smartphone,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';
import { useAuth, useCan } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  sectionLabel,
  collectionSummary,
  defaulters,
  duesBySection,
  feeStatus,
  feeSummary,
  paymentsFor,
  theCollege,
} from '@/lib/queries';
import { payFee } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/Table';
import { Avatar, EmptyState, PageHeader, Progress } from '@/components/ui/misc';
import { BarList } from '@/components/charts/Charts';
import { CollectFeeDialog } from '@/components/CollectFeeDialog';
import { DonutChart } from '@/components/charts/RingChart';
import { Legend } from '@/components/charts/ChartKit';
import { cn, formatDate, money, moneyCompact, num, pct, relativeDay } from '@/lib/utils';
import type { FeeItem, User } from '@/data/types';

const METHODS = [
  { value: 'upi', label: 'UPI', icon: Smartphone, hint: 'GPay, PhonePe, Paytm' },
  { value: 'card', label: 'Card', icon: CreditCard, hint: 'Debit or credit' },
  { value: 'netbanking', label: 'Net banking', icon: Landmark, hint: 'Any bank' },
] as const;

function paySchema(maxAmount: number) {
  return z
    .object({
      amount: z.coerce
        .number({ message: 'Enter the amount you want to pay.' })
        .positive('The amount must be more than zero.')
        .max(maxAmount, `You cannot pay more than the ${money(maxAmount)} outstanding.`),
      method: z.enum(['upi', 'card', 'netbanking']),
      upiId: z.string().trim().optional(),
    })
    .refine((v) => v.method !== 'upi' || /^[\w.\-]{2,}@[a-z]{2,}$/i.test(v.upiId ?? ''), {
      path: ['upiId'],
      message: 'Enter a valid UPI id, for example name@okicici.',
    });
}

function PayDialog({ fee, student, onClose }: { fee: FeeItem; student: User; onClose: () => void }) {
  const db = useDatabase();
  const school = theCollege(db);
  const outstanding = fee.total - fee.paid;
  const schema = paySchema(outstanding);
  const [receipt, setReceipt] = useState<{ receiptNo: string; amount: number; method: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { amount: outstanding, method: 'upi', upiId: '' },
  });

  const method = watch('method');

  if (receipt) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Payment successful"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              icon={<Download className="size-4" />}
              onClick={() => toast.info('Receipt download is simulated in this demo.')}
            >
              Download receipt
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
          <p className="mt-1 text-[13px] text-ink-3">{fee.head}</p>

          <dl className="mt-6 w-full space-y-2.5 rounded-xl bg-surface-2 px-4 py-3.5 text-left text-[12.5px]">
            {[
              ['Receipt no.', receipt.receiptNo],
              ['Student', `${student.name} · ${sectionLabel(db, student.sectionId)}`],
              ['Admission no.', student.registerNo ?? '—'],
              ['Paid by', receipt.method.toUpperCase()],
              ['Date', formatDate(new Date().toISOString().slice(0, 10))],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-ink-3">{k}</dt>
                <dd className="font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11.5px] text-ink-3">{school.name}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pay ${fee.head}`}
      description={`${money(outstanding)} outstanding · due ${formatDate(fee.dueOn)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button form="pay-form" type="submit" loading={isSubmitting}>Pay now</Button>
        </>
      }
    >
      <form
        id="pay-form"
        noValidate
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          await new Promise((r) => setTimeout(r, 900)); // gateway round-trip
          // payFee returns the receipt number it allotted.
          const receiptNo = payFee({
            feeId: fee.id,
            amount: Number(values.amount),
            method: values.method as 'upi' | 'card' | 'netbanking',
          });
          setReceipt({ receiptNo, amount: Number(values.amount), method: values.method as string });
          toast.success('Payment received', { description: `Receipt ${receiptNo}` });
        })}
      >
        <Field label="Amount" error={errors.amount?.message} hint={`Pay the full ${money(outstanding)} or part of it.`} required htmlFor="amount">
          <Input id="amount" type="number" min={1} max={outstanding} invalid={!!errors.amount} {...register('amount')} />
        </Field>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-2">How would you like to pay?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {METHODS.map(({ value, label, icon: Icon, hint }) => (
              <label
                key={value}
                className={cn(
                  'cursor-pointer rounded-xl border px-3 py-3 transition-colors',
                  method === value ? 'border-brand-500/50 bg-brand-500/[0.07]' : 'border-line hover:border-line-strong',
                )}
              >
                <input type="radio" value={value} className="sr-only" {...register('method')} />
                <Icon className={cn('size-4', method === value ? 'text-brand-600 dark:text-brand-300' : 'text-ink-3')} />
                <span className="mt-2 block text-[13px] font-semibold text-ink">{label}</span>
                <span className="mt-0.5 block text-[11px] text-ink-3">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {method === 'upi' ? (
          <Field label="UPI id" error={errors.upiId?.message} required htmlFor="upi">
            <Input id="upi" placeholder="yourname@okicici" invalid={!!errors.upiId} {...register('upiId')} />
          </Field>
        ) : (
          <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-3">
            This is a demo gateway — no card or bank details are collected and no real payment is made.
          </p>
        )}
      </form>
    </Modal>
  );
}

/* ── parent view ───────────────────────────────────────────────────────── */

function ChildFees({ student }: { student: User }) {
  const db = useDatabase();
  const summary = feeSummary(db, student.id);
  const history = paymentsFor(db, student.id);
  const [paying, setPaying] = useState<FeeItem | null>(null);
  const canPay = useCan()('fee.pay');

  const slices = [
    { label: 'Paid', value: summary.paid, color: 'var(--s3)' },
    { label: 'Outstanding', value: summary.pending, color: 'var(--s2)' },
  ];

  const columns: Column<FeeItem>[] = [
    {
      key: 'head',
      header: 'Fee',
      sortBy: (r) => r.head,
      cell: (r) => (
        <div>
          <p className="font-semibold text-ink">{r.head}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-3">
            Due {formatDate(r.dueOn)}
            {r.paid < r.total ? ` · ${relativeDay(r.dueOn)}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'total', header: 'Amount', align: 'right', sortBy: (r) => r.total, cell: (r) => <span className="tnum">{money(r.total)}</span> },
    { key: 'paid', header: 'Paid', align: 'right', hideOnMobile: true, sortBy: (r) => r.paid, cell: (r) => <span className="tnum">{money(r.paid)}</span> },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      sortBy: (r) => r.total - r.paid,
      cell: (r) => (
        <span className={cn('tnum font-semibold', r.total - r.paid > 0 ? 'text-[--color-critical]' : 'text-ink-3')}>
          {money(r.total - r.paid)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', align: 'right', cell: (r) => <StatusPill status={feeStatus(r)} /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (r) =>
        // A school that does not take online payment can withdraw fee.pay and
        // the button goes with it, rather than failing at the gateway.
        r.paid < r.total ? (
          canPay ? (
            <Button size="sm" onClick={() => setPaying(r)}>Pay</Button>
          ) : (
            <span className="text-[12px] text-ink-3">Pay at the office</span>
          )
        ) : (
          <Button size="sm" variant="ghost" icon={<Receipt className="size-3.5" />} onClick={() => toast.info('Receipt download is simulated in this demo.')}>
            Receipt
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Fees"
        subtitle={`${student.name} · ${sectionLabel(db, student.sectionId)} · admission no. ${student.registerNo}`}
      />

      <StatGrid>
        <StatTile label="Total for the year" value={moneyCompact(summary.total)} note="Tuition, bus and other fees" icon={WalletCards} />
        <StatTile label="Paid so far" value={moneyCompact(summary.paid)} note={`${pct(summary.percent, 1)} of the year`} icon={CheckCircle2} tone="good" delay={0.06} />
        <StatTile label="Outstanding" value={moneyCompact(summary.pending)} note={summary.pending ? 'Payable online' : 'Nothing outstanding'} icon={Banknote} tone={summary.pending ? 'warning' : 'good'} delay={0.12} />
        <StatTile
          label={summary.overdueAmount ? 'Overdue' : 'Next due'}
          value={summary.overdueAmount ? moneyCompact(summary.overdueAmount) : summary.nextDue ? formatDate(summary.nextDue.dueOn, { year: undefined }) : '—'}
          note={summary.overdueAmount ? 'Please clear at the earliest' : summary.nextDue ? summary.nextDue.head : 'All cleared'}
          icon={summary.overdueAmount ? TriangleAlert : Clock}
          tone={summary.overdueAmount ? 'critical' : summary.nextDue ? 'warning' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <MotionCard delay={0.1}>
          <CardHeader title="This year" subtitle={`${pct(summary.percent, 1)} of ${money(summary.total)} paid`} />
          <CardBody className="flex flex-col items-center pt-2">
            <DonutChart slices={slices} centreValue={pct(summary.percent, 0)} centreLabel="paid" size={176} />
            <Legend items={slices.map((s) => ({ color: s.color, label: s.label }))} className="mt-5 justify-center" />
            <Progress value={summary.percent} tone={summary.pending ? 'warning' : 'good'} className="mt-5" label="Fees paid" />
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader title="Fee breakdown" subtitle="Pay any item in full or in part" />
          <CardBody className="pt-4">
            <DataTable columns={columns} rows={summary.rows} />
          </CardBody>
        </MotionCard>
      </div>

      <MotionCard delay={0.2} className="mt-5">
        <CardHeader title="Payment history" subtitle={`${history.length} receipts`} />
        <CardBody className="pt-4">
          {history.length === 0 ? (
            <EmptyState icon={<Receipt className="size-6" />} title="No payments yet" />
          ) : (
            <ul className="divide-y divide-line">
              {history.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[--color-good]/12 text-[--color-good]">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {db.fees.find((f) => f.id === p.feeId)?.head ?? 'Fee payment'}
                    </span>
                    <span className="tnum mt-0.5 block truncate text-[11.5px] text-ink-3">
                      {p.receiptNo} · {p.method.toUpperCase()} · {formatDate(p.paidOn)}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-[13.5px] font-semibold text-ink">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </MotionCard>

      {paying ? (
        <PayDialog
          fee={db.fees.find((f) => f.id === paying.id) ?? paying}
          student={student}
          onClose={() => setPaying(null)}
        />
      ) : null}
    </>
  );
}

/* ── office view ───────────────────────────────────────────────────────── */

function OfficeFees() {
  const db = useDatabase();
  const can = useCan();
  const [collecting, setCollecting] = useState<User | null>(null);
  const totals = collectionSummary(db);
  const list = defaulters(db);

  const rows = db.users
    .filter((u) => u.roles.includes('student'))
    .map((student) => {
      const s = feeSummary(db, student.id);
      return {
        id: student.id,
        student,
        name: student.name,
        cls: sectionLabel(db, student.sectionId),
        billed: s.total,
        paid: s.paid,
        pending: s.pending,
        overdue: s.overdueAmount,
      };
    });

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'Student',
      sortBy: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.student.name} hue={r.student.avatarHue} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{r.name}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-3">{r.student.registerNo}</p>
          </div>
        </div>
      ),
    },
    { key: 'cls', header: 'Class', sortBy: (r) => r.cls, cell: (r) => r.cls },
    { key: 'billed', header: 'Billed', align: 'right', hideOnMobile: true, sortBy: (r) => r.billed, cell: (r) => <span className="tnum">{money(r.billed)}</span> },
    { key: 'paid', header: 'Collected', align: 'right', sortBy: (r) => r.paid, cell: (r) => <span className="tnum">{money(r.paid)}</span> },
    {
      key: 'pending',
      header: 'Outstanding',
      align: 'right',
      sortBy: (r) => r.pending,
      cell: (r) => (
        <span className={cn('tnum font-semibold', r.pending ? 'text-[--color-critical]' : 'text-ink-3')}>
          {money(r.pending)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      sortBy: (r) => r.overdue,
      cell: (r) => <StatusPill status={r.overdue > 0 ? 'due' : r.pending > 0 ? 'partial' : 'paid'} />,
    },
    {
      key: 'collect',
      header: '',
      align: 'right',
      cell: (r) =>
        can('fee.collect') && r.pending > 0 ? (
          <Button size="sm" onClick={() => setCollecting(r.student)}>
            Collect
          </Button>
        ) : null,
    },
  ];

  const slices = [
    { label: 'Collected', value: totals.paid, color: 'var(--s3)' },
    { label: 'Outstanding', value: totals.pending, color: 'var(--s2)' },
  ];

  return (
    <>
      <PageHeader title="Fees" subtitle="Collection across the school, and who still has to pay." />

      <StatGrid>
        <StatTile label="Billed this year" value={moneyCompact(totals.total)} note={`${num(rows.length)} students`} icon={WalletCards} />
        <StatTile label="Collected" value={moneyCompact(totals.paid)} note={`${pct(totals.percent, 1)} realised`} icon={CheckCircle2} tone="good" delay={0.06} />
        <StatTile label="Outstanding" value={moneyCompact(totals.pending)} note="Across all heads" icon={Banknote} tone="warning" delay={0.12} />
        <StatTile label="Overdue" value={moneyCompact(totals.overdueAmount)} note={`${totals.defaulters} students to follow up`} icon={TriangleAlert} tone={totals.overdueAmount ? 'critical' : 'good'} delay={0.18} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <MotionCard delay={0.1}>
          <CardHeader title="Collection rate" subtitle="This academic year" />
          <CardBody className="flex flex-col items-center pt-2">
            <DonutChart slices={slices} centreValue={pct(totals.percent, 0)} centreLabel="collected" size={176} />
            <Legend items={slices.map((s) => ({ color: s.color, label: s.label }))} className="mt-5 justify-center" />
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader title="Outstanding by class" subtitle="Where to chase first" />
          <CardBody className="pt-2">
            <BarList data={duesBySection(db)} valueLabel="Outstanding" height={250} />
          </CardBody>
        </MotionCard>
      </div>

      <MotionCard delay={0.2} className="mt-5">
        <CardHeader title="Follow-up list" subtitle={`${list.length} students with overdue fees`} />
        <CardBody className="pt-4">
          {list.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="size-6" />} title="No overdue fees" />
          ) : (
            <ul className="divide-y divide-line">
              {list.slice(0, 10).map((d) => (
                <li key={d.student.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={d.student.name} hue={d.student.avatarHue} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{d.student.name}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">
                      {sectionLabel(db, d.student.sectionId)} · {d.summary.overdue.map((f) => f.head).join(', ')}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-[13.5px] font-semibold text-[--color-critical]">
                    {money(d.summary.overdueAmount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </MotionCard>

      <MotionCard delay={0.24} className="mt-5">
        <CardHeader
          title="Student ledger"
          subtitle={can('fee.collect') ? 'Sort by outstanding, then collect at the counter' : 'Sort by outstanding to prioritise'}
        />
        <CardBody className="pt-4">
          <DataTable columns={columns} rows={rows} initialSort={{ key: 'pending', dir: 'desc' }} />
        </CardBody>
      </MotionCard>

      {collecting ? <CollectFeeDialog student={collecting} onClose={() => setCollecting(null)} /> : null}
    </>
  );
}

export default function Fees() {
  const { subject } = useAuth();
  const can = useCan();

  if (can('fee.view.college')) return <OfficeFees />;
  if (!subject) return <EmptyState icon={<WalletCards className="size-6" />} title="No student linked to this account" />;
  return <ChildFees student={subject} />;
}
