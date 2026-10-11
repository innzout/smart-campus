import { useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, Clock, MapPin, Pencil, TriangleAlert, User as UserIcon } from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  allClashes,
  classById,
  classSubjectsOf,
  classesByStage,
  classesForTeacher,
  periodBalance,
  slotClash,
  subjectById,
  teacherDay,
  timetableForClass,
  userById,
} from '@/lib/queries';
import { createBlankWeek, setTimetableSlot } from '@/lib/actions';
import { Button } from '@/components/ui/Button';
import { useDatabase as useDb } from '@/lib/store';
import { toast } from 'sonner';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { Select } from '@/components/ui/Field';
import { useNow } from '@/lib/clock';
import { DAY_NAMES, DAY_SHORT, TEACHING_DAYS, cn, formatTime } from '@/lib/utils';

export default function Timetable() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const db = useDatabase();
  const clock = useNow();
  const today = clock.getDay();

  const can = useCan();
  const isStaff = !user.roles.includes('parent') && !user.roles.includes('student');
  const myClasses = isStaff ? classesForTeacher(db, user.id) : [];

  /**
   * Whose timetable you may look at. A teacher gets their own classes; anyone
   * who can see the whole school gets every registered class, grouped by stage
   * — with fifteen sections a row of buttons no longer fits, and a reader
   * looking for 11-B should not have to scan a strip to find it.
   */
  const wholeSchool = can('attendance.view.school') || can('academic.view');
  const stages = classesByStage(db);
  const pickable = wholeSchool ? db.classes : myClasses;

  const [classId, setClassId] = useState(
    subject?.classId ??
      db.classes.find((c) => c.classTeacherId === user.id)?.id ??
      myClasses[0]?.id ??
      db.classes[0]?.id ?? '',
  );
  // On a Sunday there is nothing to show, so open on Monday instead.
  const [day, setDay] = useState<number>(today === 0 ? 1 : today);
  const [view, setView] = useState<'day' | 'week'>('day');
  const [editing, setEditing] = useState(false);
  // Building the week is an academic-setup job, not something a subject teacher
  // should be able to do to someone else's class.
  const canEdit = can('academic.manage');

  const cls = classById(db, classId);
  const slotsFor = (d: number) => timetableForClass(db, classId, d);
  const daySlots = slotsFor(day);
  const myPeriods = isStaff ? teacherDay(db, user.id, day) : [];

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle={
          isStaff
            ? `Class ${cls?.label} · ${cls?.room}`
            : `${subject?.name} · Class ${cls?.label} · ${cls?.room}`
        }
        action={
          <div className="flex flex-wrap gap-2">
            {isStaff && pickable.length > 1 ? (
              wholeSchool ? (
                <Select
                  aria-label="Class"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="h-9 min-w-[13rem] text-[13px]"
                >
                  {/* The teacher's own classes first — that is what they open
                      this page for — then every other section by stage. */}
                  {myClasses.length > 0 ? (
                    <optgroup label="My classes">
                      {myClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          Class {c.label} · {c.room}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {stages.map(({ stage, label, classes }) => {
                    const rest = classes.filter((c) => !myClasses.some((m) => m.id === c.id));
                    if (rest.length === 0) return null;
                    return (
                      <optgroup key={stage} label={label}>
                        {rest.map((c) => (
                          <option key={c.id} value={c.id}>
                            Class {c.label} · {c.room}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </Select>
              ) : (
                <Segmented
                  size="sm"
                  value={classId}
                  onChange={setClassId}
                  options={myClasses.map((c) => ({ value: c.id, label: c.label }))}
                />
              )
            ) : null}
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
              ]}
            />
            {canEdit && classId ? (
              <Button
                size="sm"
                variant={editing ? 'primary' : 'secondary'}
                icon={<Pencil className="size-3.5" />}
                onClick={() => setEditing((e) => !e)}
              >
                {editing ? 'Done editing' : 'Edit periods'}
              </Button>
            ) : null}
          </div>
        }
      />

      {editing && cls ? <PeriodScheduler classId={cls.id} /> : null}

      {view === 'day' ? (
        <>
          <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
            {TEACHING_DAYS.map((d) => {
              const active = d === day;
              const count = slotsFor(d).filter((s) => s.kind === 'period').length;
              return (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  className={cn(
                    'relative flex min-w-[4.6rem] flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 transition-all',
                    active ? 'border-brand-500/40 bg-brand-500/10' : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <span className={cn('text-[12px] font-semibold', active ? 'text-brand-600 dark:text-brand-300' : 'text-ink')}>
                    {DAY_SHORT[d]}
                  </span>
                  <span className="text-[10.5px] text-ink-3">{count} periods</span>
                  {d === today ? (
                    <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brand-500" aria-label="Today" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {isStaff && myPeriods.length ? (
            <MotionCard className="mb-5">
              <CardHeader title="Your periods" subtitle={`${DAY_NAMES[day]} — where you are expected`} />
              <CardBody className="pt-4">
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {myPeriods.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-500/[0.06] px-3.5 py-3">
                      <span className="tnum shrink-0 text-[13px] font-semibold text-ink">{formatTime(p.start)}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.subject}</span>
                      <Badge tone="brand">{p.className}</Badge>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </MotionCard>
          ) : null}

          <MotionCard>
            <CardHeader
              title={DAY_NAMES[day]}
              subtitle={`${daySlots.filter((s) => s.kind === 'period').length} periods${day === today ? ' · today' : ''}`}
            />
            <CardBody className="pt-4">
              {daySlots.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="size-6" />}
                  title={day === 0 ? 'Sunday — holiday' : 'Nothing scheduled'}
                />
              ) : (
                <ul className="space-y-2.5">
                  {daySlots.map((slot, i) => (
                    <motion.li
                      key={slot.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className={cn(
                        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center',
                        slot.kind !== 'period'
                          ? 'border-dashed border-line bg-surface-2/60'
                          : slot.phase === 'now'
                            ? 'border-brand-500/45 bg-brand-500/[0.07]'
                            : slot.phase === 'done'
                              ? 'border-line bg-surface-2/60'
                              : 'border-line bg-surface',
                      )}
                    >
                      <div className="flex w-full shrink-0 items-center gap-3 sm:w-32 sm:flex-col sm:items-start sm:gap-0.5">
                        <span className={cn('tnum text-[14px] font-semibold', slot.phase === 'done' ? 'text-ink-3' : 'text-ink')}>
                          {formatTime(slot.start)}
                        </span>
                        <span className="tnum text-[11.5px] text-ink-3">to {formatTime(slot.end)}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={cn('text-[14.5px] font-semibold', slot.phase === 'done' ? 'text-ink-3' : 'text-ink')}>
                            {slot.label}
                          </h3>
                          {slot.kind === 'period' ? <Badge tone="info">Period {slot.period}</Badge> : <Badge tone="neutral">Break</Badge>}
                          {slot.phase === 'now' ? (
                            <Badge tone="brand" icon={<Clock className="size-3" />}>Happening now</Badge>
                          ) : null}
                        </div>
                        {slot.kind === 'period' ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
                            {slot.labelTa ? <span>{slot.labelTa}</span> : null}
                            <span className="inline-flex items-center gap-1.5">
                              <UserIcon className="size-3.5" aria-hidden /> {slot.teacher}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="size-3.5" aria-hidden /> {cls?.room}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </CardBody>
          </MotionCard>
        </>
      ) : (
        <MotionCard>
          <CardHeader title="Week at a glance" subtitle={`Class ${cls?.label} · Monday to Saturday`} />
          <CardBody className="pt-4">
            <div className="-mx-5 overflow-x-auto px-5">
              <div className="grid min-w-[52rem] grid-cols-6 gap-3">
                {TEACHING_DAYS.map((d) => (
                  <div key={d}>
                    <p
                      className={cn(
                        'mb-2.5 rounded-lg px-2 py-1.5 text-center text-[12px] font-semibold',
                        d === today ? 'bg-brand-500/12 text-brand-600 dark:text-brand-300' : 'text-ink-2',
                      )}
                    >
                      {DAY_SHORT[d]}
                    </p>
                    <ul className="space-y-2">
                      {slotsFor(d).filter((s) => s.kind === 'period').map((slot) => (
                        <li key={slot.id} className="rounded-lg border border-line bg-surface px-2.5 py-2">
                          <p className="tnum text-[10.5px] font-medium text-ink-3">{slot.start}</p>
                          <p className="mt-0.5 text-[12px] leading-snug font-semibold text-ink">{slot.label}</p>
                          <p className="mt-0.5 truncate text-[10.5px] text-ink-3">{slot.teacher}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </MotionCard>
      )}
    </>
  );
}

/* ── building the week ────────────────────────────────────────────────── */

const SCHED_DAYS = [1, 2, 3, 4, 5, 6];

/**
 * The period scheduler.
 *
 * Assigning a teacher to a subject happens once, on Academic Setup. This screen
 * is the other half: putting those subjects into the week. The teacher follows
 * from the subject, so a cell asks only "what is taught here" — which is how a
 * school actually builds a timetable, and keeps thirty-five cells from each
 * needing two decisions.
 *
 * The part that earns its place is clash detection. Without it a double-booking
 * is discovered on Monday morning, with two classes waiting for one person.
 */
function PeriodScheduler({ classId }: { classId: string }) {
  const db = useDb();
  const cls = classById(db, classId);
  const offered = classSubjectsOf(db, classId);
  const balance = periodBalance(db, classId);
  const clashes = allClashes(db).filter((c) => c.classLabel === cls?.label);

  // One row per period, so the week reads as a grid the way a notice board does.
  const slots = db.timetable.filter((s) => s.classId === classId);
  const periodNumbers = [...new Set(slots.map((s) => s.period))].sort((a, b) => a - b);

  if (!cls) return null;

  // A class can exist without a week laid out — one created before the app
  // started doing that, or an import. The editor fills periods in, it does not
  // invent them, so offer to lay the week out rather than showing empty rows.
  if (periodNumbers.length === 0) {
    return (
      <MotionCard className="mb-5">
        <CardHeader
          title={`Build the week — ${cls.label}`}
          subtitle="This class has no periods laid out yet"
        />
        <CardBody className="pt-4">
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="No week to edit yet"
            description="Lay out the school day for this class — breaks and lunch fixed, lessons empty — and then choose what is taught in each period."
            action={
              <Button
                onClick={() => {
                  const made = createBlankWeek(cls.id);
                  toast.success(`Week laid out for ${cls.label}`, {
                    description: `${made} periods ready to fill in.`,
                  });
                }}
              >
                Lay out the week
              </Button>
            }
          />
        </CardBody>
      </MotionCard>
    );
  }

  return (
    <MotionCard className="mb-5">
      <CardHeader
        title={`Build the week — ${cls.label}`}
        subtitle="Choose what is taught in each period. The teacher comes from Academic Setup."
      />
      <CardBody className="pt-4">
        {/* Periods a week against what the subject offering asks for. */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {balance.map(({ subject, want, got }) => (
            <Badge
              key={subject!.id}
              tone={got === want ? 'good' : got > want ? 'warning' : 'critical'}
            >
              {subject!.name} {got}/{want}
            </Badge>
          ))}
        </div>

        {clashes.length > 0 ? (
          <p className="mb-4 flex items-start gap-2.5 rounded-xl bg-[--color-critical]/10 px-4 py-3 text-[12.5px] text-ink-2">
            <TriangleAlert className="mt-px size-4 shrink-0 text-[--color-critical]" aria-hidden />
            <span>
              <span className="font-semibold text-ink">
                {clashes.length} double-booking{clashes.length === 1 ? '' : 's'}.
              </span>{' '}
              {clashes
                .slice(0, 3)
                .map((c) => `${c.teacherName} is also with ${c.other}`)
                .join('; ')}
              {clashes.length > 3 ? '…' : ''}
            </span>
          </p>
        ) : null}

        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[46rem] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-16 text-left text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
                  Period
                </th>
                {SCHED_DAYS.map((d) => (
                  <th
                    key={d}
                    className="text-left text-[11px] font-semibold tracking-wider text-ink-3 uppercase"
                  >
                    {DAY_SHORT[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodNumbers.map((period) => (
                <tr key={period}>
                  <td className="align-middle text-[12px] font-semibold text-ink-2 tnum">
                    P{period}
                  </td>
                  {SCHED_DAYS.map((day) => {
                    const slot = slots.find((x) => x.day === day && x.period === period);

                    if (!slot) {
                      return (
                        <td key={day} className="rounded-lg bg-surface-2/50 px-2 py-2 text-center text-[11.5px] text-ink-3">
                          —
                        </td>
                      );
                    }

                    // Breaks and lunch are fixed by the school day, not chosen.
                    if (slot.kind === 'break' || slot.kind === 'lunch') {
                      return (
                        <td
                          key={day}
                          className="rounded-lg bg-surface-2 px-2 py-2 text-center text-[11.5px] text-ink-3"
                        >
                          {slot.title}
                        </td>
                      );
                    }

                    const clash = slotClash(db, slot.id);
                    const teacher = userById(db, slot.teacherId ?? undefined);

                    return (
                      <td key={day} className="align-top">
                        <Select
                          aria-label={`${DAY_NAMES[day]} period ${period}`}
                          value={slot.subjectId ?? ''}
                          onChange={(e) => {
                            setTimetableSlot({
                              slotId: slot.id,
                              subjectId: e.target.value || null,
                            });
                            const name = e.target.value
                              ? (subjectById(db, e.target.value)?.name ?? 'Subject')
                              : 'Free period';
                            toast.success(`${DAY_SHORT[day]} P${period}: ${name}`);
                          }}
                          className={cn(
                            'h-9 w-full text-[12.5px]',
                            clash && 'ring-2 ring-[--color-critical]/50',
                          )}
                        >
                          <option value="">Free period</option>
                          {offered.map((cs) => {
                            const sub = subjectById(db, cs.subjectId);
                            return (
                              <option key={cs.id} value={cs.subjectId}>
                                {sub?.name}
                                {sub?.hasPractical ? ' (practical)' : ''}
                              </option>
                            );
                          })}
                        </Select>

                        {slot.subjectId ? (
                          <p
                            className={cn(
                              'mt-1 truncate text-[11px]',
                              clash ? 'font-medium text-[--color-critical]' : 'text-ink-3',
                            )}
                            title={clash ? `Also with ${clash.classLabel}` : teacher?.name}
                          >
                            {clash ? `Clash · also ${clash.classLabel}` : (teacher?.name ?? '—')}
                          </p>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11.5px] leading-relaxed text-ink-3">
          A subject with no teacher against it on Academic Setup will leave the period unstaffed.
          Placing a practical puts the class in the matching laboratory and gives it the first
          batch — adjust batches from the Laboratories page.
        </p>
      </CardBody>
    </MotionCard>
  );
}
