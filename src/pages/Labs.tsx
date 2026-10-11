import { useState } from 'react';
import { toast } from 'sonner';
import {
  Beaker,
  FlaskConical,
  IndianRupee,
  Microscope,
  Package,
  Split,
  TriangleAlert,
  Users,
  Wrench,
} from 'lucide-react';
import { useCan } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  classesWithPracticals,
  classSubjectsOf,
  labSessions,
  labSummary,
  studentsInClass,
  subjectById,
  userById,
} from '@/lib/queries';
import {
  markBreakageRecovered,
  moveStudentToBatch,
  recordBreakage,
  rebuildBatches,
  saveLabItem,
  setLabStaff,
} from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { formatDate, formatTime, money } from '@/lib/utils';
import { LAB_LABEL } from '@/data/types';
import type { LabBreakage, LabItem } from '@/data/types';

/**
 * Laboratories — in-charge, apparatus, practical batches and the breakage
 * register.
 *
 * The constraint that drives everything here is bench count. A Chemistry lab
 * with 24 places cannot take a class of 30, so the class is split into batches
 * that attend on different days. Batches are therefore not an organisational
 * nicety; they are what makes the practical timetable possible at all.
 */

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CONDITION: Record<LabItem['condition'], { label: string; tone: Tone }> = {
  good: { label: 'Serviceable', tone: 'good' },
  'needs-repair': { label: 'Needs repair', tone: 'warning' },
  condemned: { label: 'Condemned', tone: 'critical' },
};

export default function Labs() {
  const db = useDatabase();
  const can = useCan();
  const manage = can('lab.manage');

  const [labId, setLabId] = useState(db.labs[0]?.id ?? '');
  const [tab, setTab] = useState<'sessions' | 'batches' | 'apparatus' | 'breakages'>('sessions');
  const [itemOpen, setItemOpen] = useState<LabItem | 'new' | null>(null);
  const [breakageOpen, setBreakageOpen] = useState(false);
  const [movingClassId, setMovingClassId] = useState<string | null>(null);

  const lab = db.labs.find((l) => l.id === labId);
  const summary = lab ? labSummary(db, lab.id) : null;
  const sessions = lab ? labSessions(db, lab.id) : [];
  const inCharge = userById(db, lab?.inChargeId);
  const assistant = userById(db, lab?.assistantId);

  const practicalClasses = classesWithPracticals(db);
  const totalUnrecovered = db.labBreakages
    .filter((b) => !b.recovered)
    .reduce((t, b) => t + b.amount, 0);

  if (!lab || !summary) {
    return (
      <EmptyState
        icon={<FlaskConical className="size-6" />}
        title="No laboratories set up"
        description="Add a laboratory to manage apparatus, batches and practical sessions."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Laboratories"
        subtitle={`${db.labs.length} labs · ${db.labBatches.length} practical batches · ${sessions.length} sessions a week in this lab`}
        action={
          <Segmented
            size="sm"
            value={labId}
            onChange={setLabId}
            options={db.labs.map((l) => ({
              value: l.id,
              label: l.kind === 'computer' ? 'Computer' : LAB_LABEL[l.kind].split(' ')[0]!,
            }))}
          />
        }
      />

      <StatGrid>
        <StatTile
          label="Bench capacity"
          value={lab.capacity}
          note={`${lab.room} · drives the batch split`}
          icon={Users}
        />
        <StatTile
          label="Apparatus items"
          value={summary.items.length}
          note={summary.needsRepair ? `${summary.needsRepair} need attention` : 'All serviceable'}
          icon={Package}
          tone={summary.needsRepair ? 'warning' : 'good'}
          delay={0.06}
        />
        <StatTile
          label="Sessions a week"
          value={summary.sessions}
          note="Practical periods timetabled"
          icon={Beaker}
          delay={0.12}
        />
        <StatTile
          label="Breakage to recover"
          value={money(totalUnrecovered)}
          note="Across all laboratories"
          icon={IndianRupee}
          tone={totalUnrecovered > 0 ? 'warning' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      {/* ── who runs this lab ── */}
      <MotionCard delay={0.08} className="mb-5">
        <CardHeader
          title={LAB_LABEL[lab.kind]}
          subtitle={`${lab.room} · ${lab.capacity} working places`}
        />
        <CardBody className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['In-charge', inCharge, 'Answerable for the lab and its records'],
              ['Lab assistant', assistant, 'Sets up practicals and keeps the register'],
            ].map(([label, person, blurb]) => (
              <div
                key={label as string}
                className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3"
              >
                <Microscope className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] tracking-wider text-ink-3 uppercase">
                    {label as string}
                  </span>
                  <span className="block truncate text-[13.5px] font-semibold text-ink">
                    {(person as { name?: string } | undefined)?.name ?? 'Not assigned'}
                  </span>
                  <span className="block truncate text-[11.5px] text-ink-3">{blurb as string}</span>
                </span>
              </div>
            ))}
          </div>

          {manage ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Change in-charge" htmlFor="ic">
                <Select
                  id="ic"
                  value={lab.inChargeId}
                  onChange={(e) => {
                    setLabStaff(lab.id, e.target.value, lab.assistantId);
                    toast.success('Lab in-charge updated');
                  }}
                >
                  {db.users
                    .filter((u) => u.designation === 'pg-assistant' || u.designation === 'bt-assistant')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Change assistant" htmlFor="ia">
                <Select
                  id="ia"
                  value={lab.assistantId}
                  onChange={(e) => {
                    setLabStaff(lab.id, lab.inChargeId, e.target.value);
                    toast.success('Lab assistant updated');
                  }}
                >
                  {db.users
                    .filter((u) => u.designation === 'lab-assistant')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
          ) : null}
        </CardBody>
      </MotionCard>

      <MotionCard delay={0.14}>
        <CardHeader
          title="Laboratory records"
          action={
            <Segmented
              size="sm"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'sessions', label: 'Timetable' },
                { value: 'batches', label: 'Batches' },
                { value: 'apparatus', label: 'Apparatus' },
                { value: 'breakages', label: 'Breakages' },
              ]}
            />
          }
        />
        <CardBody className="pt-4">
          {/* ── practical timetable ── */}
          {tab === 'sessions' ? (
            sessions.length === 0 ? (
              <EmptyState
                icon={<Beaker className="size-6" />}
                title="No practicals timetabled here"
                description="Assign a practical subject to a class and its sessions will appear."
              />
            ) : (
              <ul className="space-y-2">
                {sessions.map(({ slot, cls, subject, batch, teacher }) => (
                  <li
                    key={slot.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-[13px] font-semibold text-ink-2 tnum">
                      P{slot.period}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">
                        {cls?.label} · {subject?.name} practical
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                        {DAYS[slot.day]} · {formatTime(slot.start)}–{formatTime(slot.end)} ·{' '}
                        {teacher?.name ?? '—'}
                      </span>
                    </span>
                    {batch ? (
                      <Badge tone="brand" icon={<Split className="size-3" />}>
                        {batch.name} · {batch.studentIds.length} pupils
                      </Badge>
                    ) : (
                      <Badge tone="warning">Whole class</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {/* ── batches, across every class with practicals ── */}
          {tab === 'batches' ? (
            <div className="space-y-4">
              <p className="rounded-xl bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
                A class larger than the smallest lab it uses has to be split. The batch count below
                is what the bench capacity allows, and students are dealt round-robin by roll number
                so each batch is a mix rather than the first half of the register.
              </p>
              {practicalClasses.map(({ cls, practicals, batches }) => {
                const roll = studentsInClass(db, cls.id);
                const tightest = Math.min(
                  ...practicals.map(
                    (s) => db.labs.find((l) => l.kind === s.labKind)?.capacity ?? 30,
                  ),
                );
                const needed = Math.ceil(roll.length / tightest);
                const wrong = batches.length !== needed;
                return (
                  <div key={cls.id} className="rounded-xl border border-line px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-ink">
                          Class {cls.label}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-ink-3">
                          {roll.length} on roll · {practicals.map((s) => s.name).join(', ')} ·
                          tightest lab takes {tightest}
                        </span>
                      </span>
                      {wrong ? (
                        <Badge tone="warning" icon={<TriangleAlert className="size-3" />}>
                          Needs {needed} batch{needed === 1 ? '' : 'es'}
                        </Badge>
                      ) : (
                        <Badge tone="good">{batches.length} batches</Badge>
                      )}
                      {manage ? (
                        <span className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              rebuildBatches(cls.id, needed);
                              toast.success(`${cls.label} split into ${needed} batches`);
                            }}
                          >
                            {wrong ? 'Fix split' : 'Re-split'}
                          </Button>
                          {batches.length > 1 ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setMovingClassId(cls.id)}
                            >
                              Move pupils
                            </Button>
                          ) : null}
                        </span>
                      ) : null}
                    </div>

                    {batches.length > 0 ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {batches.map((b) => (
                          <div key={b.id} className="rounded-lg bg-surface-2 px-3 py-2.5">
                            <p className="text-[12.5px] font-semibold text-ink">
                              {b.name}
                              <span className="ml-1.5 font-normal text-ink-3">
                                {b.studentIds.length} pupils
                              </span>
                            </p>
                            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
                              Roll{' '}
                              {b.studentIds
                                .map((id) => userById(db, id)?.rollNo)
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* ── apparatus register ── */}
          {tab === 'apparatus' ? (
            <>
              {manage ? (
                <div className="mb-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Package className="size-3.5" />}
                    onClick={() => setItemOpen('new')}
                  >
                    Add item
                  </Button>
                </div>
              ) : null}
              <DataTable
                rows={summary.items}
                initialSort={{ key: 'name', dir: 'asc' }}
                empty="No apparatus recorded for this laboratory."
                onRowClick={manage ? (row) => setItemOpen(row) : undefined}
                columns={
                  [
                    {
                      key: 'name',
                      header: 'Item',
                      sortBy: (r) => r.name,
                      cell: (r) => <span className="font-medium text-ink">{r.name}</span>,
                    },
                    {
                      key: 'quantity',
                      header: 'In stock',
                      align: 'right',
                      sortBy: (r) => r.quantity,
                      cell: (r) => (
                        <span className="tnum">
                          {r.quantity} {r.unit}
                        </span>
                      ),
                    },
                    {
                      key: 'condition',
                      header: 'Condition',
                      sortBy: (r) => r.condition,
                      cell: (r) => (
                        <Badge
                          tone={CONDITION[r.condition].tone}
                          icon={r.condition === 'good' ? undefined : <Wrench className="size-3" />}
                        >
                          {CONDITION[r.condition].label}
                        </Badge>
                      ),
                    },
                  ] satisfies Column<LabItem>[]
                }
              />
            </>
          ) : null}

          {/* ── breakage register ── */}
          {tab === 'breakages' ? (
            <>
              {can('lab.breakage.record') ? (
                <div className="mb-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<TriangleAlert className="size-3.5" />}
                    onClick={() => setBreakageOpen(true)}
                  >
                    Record a breakage
                  </Button>
                </div>
              ) : null}
              <DataTable
                rows={summary.breakages}
                initialSort={{ key: 'date', dir: 'desc' }}
                empty="Nothing broken in this laboratory. Long may it last."
                columns={
                  [
                    {
                      key: 'date',
                      header: 'Date',
                      sortBy: (r) => r.date,
                      cell: (r) => <span className="tnum">{formatDate(r.date)}</span>,
                    },
                    {
                      key: 'student',
                      header: 'Student',
                      cell: (r) => {
                        const student = userById(db, r.studentId);
                        return (
                          <span>
                            <span className="block font-medium text-ink">
                              {student?.name ?? '—'}
                            </span>
                            <span className="block text-[11.5px] text-ink-3">
                              {db.classes.find((c) => c.id === student?.classId)?.label}
                            </span>
                          </span>
                        );
                      },
                    },
                    {
                      key: 'item',
                      header: 'Item',
                      hideOnMobile: true,
                      cell: (r) => (
                        <span>
                          {db.labItems.find((i) => i.id === r.itemId)?.name ?? '—'}
                          <span className="ml-1 text-ink-3">× {r.quantity}</span>
                        </span>
                      ),
                    },
                    {
                      key: 'amount',
                      header: 'Recovery',
                      align: 'right',
                      sortBy: (r) => r.amount,
                      cell: (r) => <span className="tnum">{money(r.amount)}</span>,
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      cell: (r) =>
                        r.recovered ? (
                          <Badge tone="good">Recovered</Badge>
                        ) : can('lab.breakage.record') ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              markBreakageRecovered(r.id);
                              toast.success('Marked as recovered');
                            }}
                          >
                            Mark recovered
                          </Button>
                        ) : (
                          <Badge tone="warning">Outstanding</Badge>
                        ),
                    },
                  ] satisfies Column<LabBreakage>[]
                }
              />
            </>
          ) : null}
        </CardBody>
      </MotionCard>

      {itemOpen ? (
        <ItemDialog
          labId={lab.id}
          item={itemOpen === 'new' ? null : itemOpen}
          onClose={() => setItemOpen(null)}
        />
      ) : null}
      {breakageOpen ? (
        <BreakageDialog labId={lab.id} onClose={() => setBreakageOpen(false)} />
      ) : null}
      {movingClassId ? (
        <MoveBatchDialog classId={movingClassId} onClose={() => setMovingClassId(null)} />
      ) : null}
    </>
  );
}

/* ── moving a pupil between batches ──────────────────────────────────── */

/**
 * A round-robin split is a starting point, not an answer. Siblings want the
 * same day, a child on the late bus cannot make the first period, and a pair
 * who should not share a bench need separating. So the split is adjustable one
 * pupil at a time, and the batch sizes are shown against the lab's capacity so
 * a move that overfills a bench is visible before it is made.
 */
function MoveBatchDialog({ classId, onClose }: { classId: string; onClose: () => void }) {
  const db = useDatabase();
  const cls = db.classes.find((c) => c.id === classId);
  const batches = db.labBatches.filter((b) => b.classId === classId);

  // The tightest lab this class uses is what a batch actually has to fit into.
  const capacity = Math.min(
    ...classSubjectsOf(db, classId)
      .map((cs) => subjectById(db, cs.subjectId))
      .filter((sub) => sub?.hasPractical)
      .map((sub) => db.labs.find((l) => l.kind === sub!.labKind)?.capacity ?? 30),
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Class ${cls?.label} — practical batches`}
      description={`The tightest lab this class uses takes ${capacity} at a time.`}
      size="lg"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {batches.map((batch) => {
          const over = batch.studentIds.length > capacity;
          return (
            <div key={batch.id} className="rounded-xl border border-line p-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <p className="text-[13.5px] font-semibold text-ink">{batch.name}</p>
                <Badge tone={over ? 'critical' : 'neutral'}>
                  {batch.studentIds.length}/{capacity}
                </Badge>
              </div>

              {over ? (
                <p className="mb-2 text-[12px] text-[--color-critical]">
                  More pupils than benches. Move some to another batch.
                </p>
              ) : null}

              <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {batch.studentIds
                  .map((id) => userById(db, id))
                  .filter((st) => st)
                  .sort((a, b) => (a!.rollNo ?? 0) - (b!.rollNo ?? 0))
                  .map((st) => (
                    <li key={st!.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
                      <Avatar name={st!.name} hue={st!.avatarHue} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-ink">
                          {st!.name}
                        </span>
                        <span className="block text-[11px] text-ink-3 tnum">
                          Roll {st!.rollNo}
                        </span>
                      </span>
                      {/* One control per pupil, listing only the other batches. */}
                      <Select
                        aria-label={`Move ${st!.name} to another batch`}
                        value=""
                        className="h-8 w-28 text-[12px]"
                        onChange={(e) => {
                          if (!e.target.value) return;
                          moveStudentToBatch(st!.id, e.target.value);
                          const to = batches.find((b) => b.id === e.target.value);
                          toast.success(`${st!.name} moved to ${to?.name ?? 'the other batch'}`);
                        }}
                      >
                        <option value="">Move to…</option>
                        {batches
                          .filter((b) => b.id !== batch.id)
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                      </Select>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* ── apparatus entry ──────────────────────────────────────────────────── */

function ItemDialog({
  labId,
  item,
  onClose,
}: {
  labId: string;
  item: LabItem | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [unit, setUnit] = useState(item?.unit ?? 'nos');
  const [condition, setCondition] = useState<LabItem['condition']>(item?.condition ?? 'good');

  const submit = () => {
    if (!name.trim()) return;
    saveLabItem({ id: item?.id, labId, name: name.trim(), quantity, unit, condition });
    toast.success(item ? 'Item updated' : 'Item added to the register');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? item.name : 'Add apparatus'}
      description="The stock register the lab assistant maintains."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Item" required htmlFor="in">
          <Input id="in" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" htmlFor="iq">
            <Input
              id="iq"
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </Field>
          <Field label="Unit" htmlFor="iu">
            <Input id="iu" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>
        </div>
        <Field label="Condition" htmlFor="ic2">
          <Select
            id="ic2"
            value={condition}
            onChange={(e) => setCondition(e.target.value as LabItem['condition'])}
          >
            <option value="good">Serviceable</option>
            <option value="needs-repair">Needs repair</option>
            <option value="condemned">Condemned</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

/* ── breakage entry ──────────────────────────────────────────────────── */

function BreakageDialog({ labId, onClose }: { labId: string; onClose: () => void }) {
  const db = useDatabase();
  const items = db.labItems.filter((i) => i.labId === labId);
  // Only students who actually have a practical in this lab can break its glass.
  const lab = db.labs.find((l) => l.id === labId);
  const eligible = db.classes
    .filter((c) =>
      classSubjectsOf(db, c.id).some(
        (cs) => subjectById(db, cs.subjectId)?.labKind === lab?.kind,
      ),
    )
    .flatMap((c) => studentsInClass(db, c.id));

  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [studentId, setStudentId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState('');

  const submit = () => {
    if (!itemId || !studentId) return;
    recordBreakage({ labId, itemId, studentId, quantity, amount, note: note.trim() });
    toast.success('Breakage recorded', {
      description: 'Stock has been reduced and the parent notified of the recovery.',
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Record a breakage"
      description="Stock falls by the quantity broken and the recovery is added to the fee account."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!itemId || !studentId}>
            Record
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Item" required htmlFor="bi">
          <Select id="bi" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.quantity} {i.unit} in stock)
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Student"
          required
          htmlFor="bs"
          hint="Only classes with a practical in this lab are listed."
        >
          <Select id="bs" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Choose a student…</option>
            {eligible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {db.classes.find((c) => c.id === s.classId)?.label} · roll {s.rollNo}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" htmlFor="bq">
            <Input
              id="bq"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </Field>
          <Field label="Recovery (₹)" htmlFor="ba">
            <Input
              id="ba"
              type="number"
              min={0}
              step={10}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Note" htmlFor="bn">
          <Textarea
            id="bn"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Slipped while titrating."
          />
        </Field>
      </div>
    </Modal>
  );
}
