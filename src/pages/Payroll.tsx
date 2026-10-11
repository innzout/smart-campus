import { useState } from 'react';
import { toast } from 'sonner';
import {
  BadgeIndianRupee,
  CheckCircle2,
  Download,
  Info,
  Play,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react';
import { useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { payrollMonths, payrollSummary, payslipsFor, userById } from '@/lib/queries';
import {
  approvePayslips,
  payPayslip,
  revertPayslip,
  runPayroll,
  saveSalaryStructure,
  setLopDays,
} from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/Table';
import { Avatar, EmptyState, PageHeader } from '@/components/ui/misc';
import { formatDate, money } from '@/lib/utils';
import { DESIGNATION_LABEL } from '@/data/types';
import type { Payslip, User } from '@/data/types';

/**
 * Payroll — salary structures, monthly payslips, and what is deducted.
 *
 * Be clear about what this is: the arithmetic is indicative. Provident fund at
 * 12% of basic against the ₹15,000 wage ceiling, ESI at 0.75% below ₹21,000 and
 * professional tax as a flat slab are the right shapes, but a school files
 * returns from this and the figures must come from its own sanctioned scales.
 * Statutory calculation and challan generation belong on the server.
 */

const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Payroll() {
  const db = useDatabase();
  const can = useCan();
  const me = useCurrentUser();
  const manage = can('payroll.manage');
  // Someone with only payroll.view sees their own payslips, nothing else.
  if (!manage) return <MyPayslips user={me} />;
  const months = payrollMonths(db);
  const [month, setMonth] = useState(months[0] ?? thisMonth());
  const [detail, setDetail] = useState<Payslip | null>(null);
  const [structureFor, setStructureFor] = useState<User | null>(null);
  const unpaid = db.payslips.filter((p) => p.month === month && p.status !== 'paid').length;
  const summary = payrollSummary(db, month);
  const notRun = summary.headcount === 0;
  const allPaid = summary.headcount > 0 && summary.paid === summary.headcount;
  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle={`${db.salaries.length} salary structures on file · ${monthLabel(month)}`}
        action={
          <>
            <Select
              aria-label="Month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 min-w-[11rem] text-[13px]"
            >
              {[...new Set([thisMonth(), ...months])].map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
            {notRun ? (
              <Button
                icon={<Play className="size-4" />}
                onClick={() => {
                  const created = runPayroll(month);
                  toast.success(
                    created
                      ? `${created} payslips generated for ${monthLabel(month)}`
                      : 'Nothing to generate',
                    { description: created ? 'Check them, then approve to pay.' : undefined },
                  );
                }}
              >
                Run payroll
              </Button>
            ) : !allPaid ? (
              <Button
                icon={<CheckCircle2 className="size-4" />}
                onClick={() => {
                  approvePayslips(month);
                  toast.success(`${monthLabel(month)} payroll approved`, {
                    description: `${unpaid} payslip${unpaid === 1 ? '' : 's'} paid. Everyone affected has been notified.`,
                  });
                }}
              >
                Pay all {unpaid}
              </Button>
            ) : (
              <Badge tone="good" icon={<CheckCircle2 className="size-3" />}>
                Paid
              </Badge>
            )}
          </>
        }
      />
      <StatGrid>
        <StatTile
          label="On payroll"
          value={summary.headcount || db.salaries.length}
          note="Staff drawing salary"
          icon={Users}
        />
        <StatTile
          label="Gross"
          value={money(summary.gross)}
          note="Before deductions"
          icon={Wallet}
          delay={0.06}
        />
        <StatTile
          label="Deductions"
          value={money(summary.deductions)}
          note="PF, ESI and professional tax"
          icon={Receipt}
          delay={0.12}
        />
        <StatTile
          label="Net payable"
          value={money(summary.net)}
          note={allPaid ? 'Credited' : notRun ? 'Payroll not yet run' : 'Awaiting approval'}
          icon={BadgeIndianRupee}
          tone={allPaid ? 'good' : notRun ? 'neutral' : 'warning'}
          delay={0.18}
        />
      </StatGrid>
      <div className="mb-5 flex gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3.5">
        <Info className="mt-px size-4 shrink-0 text-ink-3" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">These figures are indicative.</span> The
          deduction logic has the right shape — provident fund at 12% of basic against the ₹15,000
          ceiling, ESI below ₹21,000, professional tax by slab — but your sanctioned scales, PF and
          ESI registration numbers and challan formats are what a real run needs. That calculation
          belongs on the server, not in a browser.
        </p>
      </div>
      <MotionCard delay={0.1}>
        <CardHeader
          title={`Payslips — ${monthLabel(month)}`}
          subtitle={
            notRun
              ? 'Payroll has not been run for this month'
              : `${summary.paid} of ${summary.headcount} paid`
          }
        />
        <CardBody className="pt-4">
          {notRun ? (
            <EmptyState
              icon={<Play className="size-6" />}
              title="Payroll not run yet"
              description={`Generate payslips for ${monthLabel(month)} from the salary structures on file.`}
            />
          ) : (
            <DataTable
              rows={summary.slips.map((r) => ({ ...r.slip, staff: r.staff! }))}
              initialSort={{ key: 'net', dir: 'desc' }}
              onRowClick={(row) => setDetail(row)}
              columns={
                [
                  {
                    key: 'staff',
                    header: 'Staff',
                    sortBy: (r) => r.staff.name,
                    cell: (r) => (
                      <span className="flex items-center gap-2.5">
                        <Avatar name={r.staff.name} hue={r.staff.avatarHue} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">
                            {r.staff.name}
                          </span>
                          <span className="block truncate text-[11.5px] text-ink-3">
                            {r.staff.designation ? DESIGNATION_LABEL[r.staff.designation] : 'Staff'}{' '}
                            · {r.staff.employeeId}
                          </span>
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: 'gross',
                    header: 'Gross',
                    align: 'right',
                    hideOnMobile: true,
                    sortBy: (r) => r.gross,
                    cell: (r) => <span className="tnum">{money(r.gross)}</span>,
                  },
                  {
                    key: 'lop',
                    header: 'LOP',
                    align: 'right',
                    hideOnMobile: true,
                    sortBy: (r) => r.lopDays,
                    cell: (r) =>
                      r.lopDays ? (
                        <Badge tone="warning">{r.lopDays}d</Badge>
                      ) : (
                        <span className="text-ink-3">—</span>
                      ),
                  },
                  {
                    key: 'deductions',
                    header: 'Deductions',
                    align: 'right',
                    hideOnMobile: true,
                    sortBy: (r) => r.deductions,
                    cell: (r) => <span className="tnum">{money(r.deductions)}</span>,
                  },
                  {
                    key: 'net',
                    header: 'Net',
                    align: 'right',
                    sortBy: (r) => r.net,
                    cell: (r) => (
                      <span className="font-semibold text-ink tnum">{money(r.net)}</span>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    cell: (r) =>
                      r.status === 'paid' ? (
                        <Badge tone="good" icon={<CheckCircle2 className="size-3" />}>
                          Paid {r.paidOn ? formatDate(r.paidOn) : ''}
                        </Badge>
                      ) : (
                        <Badge tone="warning">Draft</Badge>
                      ),
                  },
                  {
                    // Paying one person at a time is the common case, not the
                    // exception: somebody joins mid-month, a transfer bounces,
                    // or one person's loss of pay is still being worked out.
                    key: 'pay',
                    header: '',
                    align: 'right',
                    cell: (r) =>
                      r.status === 'paid' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            revertPayslip(r.id);
                            toast.success('Put back to draft', {
                              description: `${r.staff.name}'s payslip can be corrected and paid again.`,
                            });
                          }}
                        >
                          Undo
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            payPayslip(r.id);
                            toast.success(`${r.staff.name} paid`, {
                              description: `Net ${money(r.net)} credited. They have been notified.`,
                            });
                          }}
                        >
                          Pay {money(r.net)}
                        </Button>
                      ),
                  },
                ] satisfies Column<Payslip & { staff: User }>[]
              }
            />
          )}
        </CardBody>
      </MotionCard>
      <MotionCard delay={0.16} className="mt-5">
        <CardHeader
          title="Salary structures"
          subtitle="Someone with no structure on file is left out of every run until one is set"
        />
        <CardBody className="pt-4">
          {(() => {
            const staff = db.users.filter(
              (u) => !!u.employeeId && u.designation !== 'correspondent',
            );
            const without = staff.filter((u) => !db.salaries.some((s) => s.staffId === u.id));
            return (
              <>
                {without.length > 0 ? (
                  <p className="mb-3 rounded-xl bg-[--color-warning]/12 px-4 py-3 text-[12.5px] text-ink-2">
                    <span className="font-semibold text-ink">
                      {without.length} member{without.length === 1 ? '' : 's'} of staff have no
                      salary on file.
                    </span>{' '}
                    They are skipped by every payroll run until one is set.
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {staff.map((u) => {
                    const salary = db.salaries.find((sl) => sl.staffId === u.id);
                    const gross = salary
                      ? salary.basic +
                        salary.da +
                        salary.hra +
                        salary.conveyance +
                        salary.otherAllowance
                      : 0;
                    return (
                      <li
                        key={u.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-2.5"
                      >
                        <Avatar name={u.name} hue={u.avatarHue} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-ink">
                            {u.name}
                          </span>
                          <span className="block truncate text-[11.5px] text-ink-3">
                            {u.designation ? DESIGNATION_LABEL[u.designation] : 'Staff'} ·{' '}
                            {u.employeeId}
                          </span>
                        </span>
                        {salary ? (
                          <span className="text-[12.5px] text-ink-2 tnum">
                            {money(gross)} gross
                          </span>
                        ) : (
                          <Badge tone="warning">No structure</Badge>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => setStructureFor(u)}>
                          {salary ? 'Edit' : 'Set salary'}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </>
            );
          })()}
        </CardBody>
      </MotionCard>
      {detail ? <PayslipDialog payslip={detail} editable onClose={() => setDetail(null)} /> : null}
      {structureFor ? (
        <SalaryDialog staff={structureFor} onClose={() => setStructureFor(null)} />
      ) : null}
    </>
  );
}

/* ── setting someone's pay ───────────────────────────────────────────── */
/**
 * Basic pay is the figure a school decides; everything else follows from it by
 * rule, so the allowances and deductions are computed and shown rather than
 * typed. That is how a school's own scale actually works — one number per post,
 * and the rest is policy.
 */

function SalaryDialog({ staff, onClose }: { staff: User; onClose: () => void }) {
  const db = useDatabase();
  const existing = db.salaries.find((s) => s.staffId === staff.id);
  const [basic, setBasic] = useState(existing?.basic ?? 24000);
  const [otherAllowance, setOtherAllowance] = useState(existing?.otherAllowance ?? 0);
  const da = Math.round(basic * 0.18);
  const hra = Math.round(basic * 0.1);
  const conveyance = existing?.conveyance ?? 1600;
  // Provident fund is 12% of basic, capped at the ₹15,000 statutory wage
  // ceiling; ESI applies below ₹21,000; professional tax is a flat slab.
  const pf = Math.round(Math.min(basic, 15000) * 0.12);
  const esi = basic + da <= 21000 ? Math.round((basic + da) * 0.0075) : 0;
  const professionalTax = basic >= 21000 ? 208 : 135;
  const gross = basic + da + hra + conveyance + otherAllowance;
  const deductions = pf + esi + professionalTax;
  return (
    <Modal
      open
      onClose={onClose}
      title={staff.name}
      description={`${staff.designation ? DESIGNATION_LABEL[staff.designation] : 'Staff'} · ${staff.employeeId}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={basic <= 0}
            onClick={() => {
              saveSalaryStructure({
                staffId: staff.id,
                basic,
                da,
                hra,
                conveyance,
                otherAllowance,
                pf,
                esi,
                professionalTax,
              });
              toast.success(`${staff.name}'s salary saved`, {
                description: `Net ${money(gross - deductions)} a month. Included from the next run.`,
              });
              onClose();
            }}
          >
            Save structure
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Basic pay (₹)" required htmlFor="sb">
            <Input
              id="sb"
              type="number"
              min={0}
              step={500}
              value={basic}
              onChange={(e) => setBasic(Number(e.target.value))}
            />
          </Field>
          <Field label="Other allowance (₹)" htmlFor="soa">
            <Input
              id="soa"
              type="number"
              min={0}
              step={100}
              value={otherAllowance}
              onChange={(e) => setOtherAllowance(Number(e.target.value))}
            />
          </Field>
        </div>
        <dl className="space-y-1.5 rounded-xl bg-surface-2 px-4 py-3 text-[12.5px]">
          {[
            ['Dearness allowance (18% of basic)', da],
            ['House rent allowance (10%)', hra],
            ['Conveyance', conveyance],
            ['Provident fund (12%, capped at ₹15,000)', -pf],
            [esi ? 'ESI (0.75%)' : 'ESI (not applicable above ₹21,000)', -esi],
            ['Professional tax', -professionalTax],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between gap-3">
              <dt className="text-ink-3">{label as string}</dt>
              <dd className="font-medium text-ink tnum">
                {(value as number) < 0 ? '−' : ''}
                {money(Math.abs(value as number))}
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-line pt-1.5">
            <dt className="font-semibold text-ink">Net a month</dt>
            <dd className="font-semibold text-ink tnum">{money(gross - deductions)}</dd>
          </div>
        </dl>
        <p className="text-[11.5px] leading-relaxed text-ink-3">
          The percentages here are indicative. Your school's own sanctioned scale, PF and ESI
          registration numbers and challan formats are what a filed return needs.
        </p>
      </div>
    </Modal>
  );
}

/* ── a single payslip ─────────────────────────────────────────────────── */

function PayslipDialog({
  payslip,
  editable,
  onClose,
}: {
  payslip: Payslip;
  editable: boolean;
  onClose: () => void;
}) {
  const db = useDatabase();
  const staff = userById(db, payslip.staffId);
  const salary = db.salaries.find((s) => s.staffId === payslip.staffId);
  const [lop, setLop] = useState(payslip.lopDays);
  if (!staff || !salary) return null;
  const earnings: [string, number][] = [
    ['Basic pay', salary.basic],
    ['Dearness allowance', salary.da],
    ['House rent allowance', salary.hra],
    ['Conveyance', salary.conveyance],
    ['Other allowance', salary.otherAllowance],
  ];
  const deductions: [string, number][] = [
    ['Provident fund (employee)', salary.pf],
    ['ESI (employee)', salary.esi],
    ['Professional tax', salary.professionalTax],
  ];
  return (
    <Modal
      open
      onClose={onClose}
      title={staff.name}
      description={`${staff.designation ? DESIGNATION_LABEL[staff.designation] : 'Staff'} · ${staff.employeeId} · ${monthLabel(payslip.month)}`}
      size="md"
      footer={
        <>
          <Button
            variant="secondary"
            icon={<Download className="size-4" />}
            onClick={() =>
              toast.info('Payslip download is not built in this prototype', {
                description: 'PDF generation is part of the server work.',
              })
            }
          >
            Download payslip
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="space-y-4">
        {editable && payslip.status !== 'paid' ? (
          <div className="flex flex-wrap items-end gap-3 rounded-xl bg-surface-2 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium text-ink">
                Days lost to unpaid absence
              </span>
              <span className="block text-[11.5px] text-ink-3">
                Recalculates the gross and net for this month.
              </span>
            </span>
            <Input
              type="number"
              min={0}
              max={30}
              aria-label="Loss of pay days"
              value={lop}
              onChange={(e) => setLop(Number(e.target.value))}
              className="h-9 w-20 text-[13px]"
            />
            <Button
              size="sm"
              onClick={() => {
                setLopDays(payslip.id, lop);
                toast.success('Payslip recalculated');
              }}
            >
              Apply
            </Button>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Earnings', earnings],
            ['Deductions', deductions],
          ].map(([heading, rows]) => (
            <div key={heading as string}>
              <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
                {heading as string}
              </p>
              <dl className="space-y-1.5 text-[12.5px]">
                {(rows as [string, number][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-ink-2">{label}</dt>
                    <dd className="font-medium text-ink tnum">{money(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <dl className="space-y-1.5 rounded-xl bg-surface-2 px-4 py-3 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">
              Gross{payslip.lopDays ? ` (after ${payslip.lopDays} day LOP)` : ''}
            </dt>
            <dd className="font-medium text-ink tnum">{money(payslip.gross)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Total deductions</dt>
            <dd className="font-medium text-ink tnum">−{money(payslip.deductions)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-1.5">
            <dt className="font-semibold text-ink">Net pay</dt>
            <dd className="font-semibold text-ink tnum">{money(payslip.net)}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}

/* ── a member of staff looking at their own payslips ─────────────────── */

function MyPayslips({ user }: { user: User }) {
  const db = useDatabase();
  const slips = payslipsFor(db, user.id);
  const [detail, setDetail] = useState<Payslip | null>(null);
  const latest = slips.find((s) => s.status === 'paid');
  return (
    <>
      <PageHeader
        title="My salary"
        subtitle={`${user.designation ? DESIGNATION_LABEL[user.designation] : 'Staff'} · ${user.employeeId ?? ''}`}
      />
      {slips.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="No payslips yet"
          description="Your payslips will appear here once payroll has been run."
        />
      ) : (
        <>
          <StatGrid>
            <StatTile
              label="Last credited"
              value={latest ? money(latest.net) : '—'}
              note={latest ? monthLabel(latest.month) : 'Nothing paid yet'}
              icon={BadgeIndianRupee}
              tone="good"
            />
            <StatTile
              label="Payslips available"
              value={slips.length}
              note="Open one to see the breakdown"
              icon={Receipt}
              delay={0.06}
            />
          </StatGrid>
          <MotionCard delay={0.1}>
            <CardHeader title="Payslips" subtitle="Most recent first" />
            <CardBody className="pt-4">
              <ul className="space-y-2">
                {slips.map((slip) => (
                  <li key={slip.id}>
                    <button
                      type="button"
                      onClick={() => setDetail(slip)}
                      className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-ink">
                          {monthLabel(slip.month)}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-ink-3">
                          Gross {money(slip.gross)} · deductions {money(slip.deductions)}
                          {slip.lopDays ? ` · ${slip.lopDays} day LOP` : ''}
                        </span>
                      </span>
                      <span className="font-semibold text-ink tnum">{money(slip.net)}</span>
                      {slip.status === 'paid' ? (
                        <Badge tone="good">Paid</Badge>
                      ) : (
                        <Badge tone="warning">Being processed</Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </MotionCard>
        </>
      )}
      {detail ? (
        <PayslipDialog payslip={detail} editable={false} onClose={() => setDetail(null)} />
      ) : null}
    </>
  );
}
