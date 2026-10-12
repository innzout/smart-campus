import { useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { CalendarDays, Clock, MapPin, Pencil, TriangleAlert, User as UserIcon } from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  allClashes,
  courseById,
  facultyDay,
  hourBalance,
  offeringsOf,
  programmesByDepartment,
  sectionById,
  sectionsForFaculty,
  slotClash,
  timetableForSection,
  userById,
} from '@/lib/queries';
import { createBlankWeek, setTimetableSlot } from '@/lib/actions';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { useNow } from '@/lib/clock';
import { DAY_NAMES, DAY_SHORT, TEACHING_DAYS, cn, formatTime } from '@/lib/utils';

/**
 * The timetable, counted in hours rather than periods.
 *
 * A college day is eight hours and a cohort's week is built from the hours each
 * paper is allotted by the syllabus. Library and mentoring hours are real parts
 * of that week, not gaps, so they are shown as what they are.
 */
export default function Timetable() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const db = useDatabase();
  const can = useCan();
  const clock = useNow();
  const today = clock.getDay();

  const isStaff = !user.roles.includes('parent') && !user.roles.includes('student');
  const mySections = isStaff ? sectionsForFaculty(db, user.id) : [];

  // Anyone who can see the whole college gets every cohort; a member of staff
  // gets their own. With fourteen cohorts a row of buttons no longer fits.
  const wholeCollege = can('attendance.view.college') || can('academic.view');
  const pickable = wholeCollege ? db.sections : mySections;
  const tree = programmesByDepartment(db);

  const [sectionId, setSectionId] = useState(
    subject?.sectionId ??
      db.sections.find((s) => s.tutorId === user.id)?.id ??
      mySections[0]?.id ??
      db.sections[0]?.id ??
      '',
  );
  const [day, setDay] = useState<number>(today === 0 ? 1 : today);
  const [view, setView] = useState<'day' | 'week'>('day');
  const [editing, setEditing] = useState(false);
  const canEdit = can('timetable.manage');

  const section = sectionById(db, sectionId);
  const hoursFor = (d: number) => timetableForSection(db, sectionId, d);
  const dayHours = hoursFor(day);
  const myHours = isStaff ? facultyDay(db, user.id, day) : [];

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle={
          section
            ? `${section.label} · semester ${section.semester} · ${section.room}`
            : 'No cohort selected'
        }
        action={
          <div className="flex flex-wrap gap-2">
            {isStaff && pickable.length > 1 ? (
              wholeCollege ? (
                <Select
                  aria-label="Cohort"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="h-9 min-w-[14rem] text-[13px]"
                >
                  {mySections.length > 0 ? (
                    <optgroup label="My cohorts">
                      {mySections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label} · sem {s.semester}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {tree.map(({ department, programmes }) => {
                    const rest = db.sections.filter(
                      (s) =>
                        programmes.some((p) => p.id === s.programmeId) &&
                        !mySections.some((m) => m.id === s.id),
                    );
                    if (rest.length === 0) return null;
                    return (
                      <optgroup key={department.id} label={department.name}>
                        {rest.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label} · sem {s.semester}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </Select>
              ) : (
                <Segmented
                  size="sm"
                  value={sectionId}
                  onChange={setSectionId}
                  options={mySections.map((s) => ({ value: s.id, label: s.label }))}
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
            {canEdit && sectionId ? (
              <Button
                size="sm"
                variant={editing ? 'primary' : 'secondary'}
                icon={<Pencil className="size-3.5" />}
                onClick={() => setEditing((e) => !e)}
              >
                {editing ? 'Done editing' : 'Edit hours'}
              </Button>
            ) : null}
          </div>
        }
      />

      {editing && section ? <HourScheduler sectionId={section.id} /> : null}

      {view === 'day' ? (
        <>
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {TEACHING_DAYS.map((d) => {
              const active = d === day;
              const count = hoursFor(d).filter((s) => s.offeringId).length;
              return (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  className={cn(
                    'relative flex min-w-[4.6rem] flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 transition-all',
                    active
                      ? 'border-brand-500/40 bg-brand-500/10'
                      : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <span
                    className={cn(
                      'text-[12px] font-semibold',
                      active ? 'text-brand-600 dark:text-brand-300' : 'text-ink',
                    )}
                  >
                    {DAY_SHORT[d]}
                  </span>
                  <span className="text-[10.5px] text-ink-3">{count} hours</span>
                  {d === today ? (
                    <span
                      className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brand-500"
                      aria-label="Today"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          {isStaff && myHours.length ? (
            <MotionCard className="mb-5">
              <CardHeader
                title="Your hours"
                subtitle={`${DAY_NAMES[day]} — where you are expected`}
              />
              <CardBody className="pt-4">
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {myHours.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-500/[0.06] px-3.5 py-3"
                    >
                      <span className="tnum shrink-0 whitespace-nowrap text-[13px] font-semibold text-ink">
                        {formatTime(h.start)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {h.course}
                      </span>
                      <Badge tone="brand">{h.sectionName}</Badge>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </MotionCard>
          ) : null}

          <MotionCard>
            <CardHeader
              title={DAY_NAMES[day]}
              subtitle={`${dayHours.filter((s) => s.offeringId).length} taught hours${day === today ? ' · today' : ''}`}
            />
            <CardBody className="pt-4">
              {dayHours.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="size-6" />}
                  title={day === 0 ? 'Sunday — holiday' : 'Nothing scheduled'}
                />
              ) : (
                <ul className="space-y-2">
                  {dayHours.map((slot, i) => (
                    <motion.li
                      key={slot.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.03 }}
                      className={cn(
                        'flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-3',
                        slot.phase === 'now'
                          ? 'border-brand-500/45 bg-brand-500/[0.07]'
                          : slot.kind === 'break' || slot.kind === 'lunch'
                            ? 'border-line bg-surface-2/60'
                            : 'border-line',
                        slot.phase === 'done' && 'opacity-60',
                      )}
                    >
                      <span className="tnum min-w-16 shrink-0 whitespace-nowrap text-[12px] font-medium text-ink-3">
                        {formatTime(slot.start)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {slot.label}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
                          {slot.code ? <span>{slot.code}</span> : null}
                          {slot.offeringId ? (
                            <span className="inline-flex items-center gap-1">
                              <UserIcon className="size-3" aria-hidden />
                              {slot.faculty}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" aria-hidden />
                            {slot.room}
                          </span>
                        </span>
                      </span>
                      {slot.kind === 'lab' ? (
                        <Badge tone="info">Practical</Badge>
                      ) : slot.kind === 'mentoring' ? (
                        <Badge tone="brand">Mentoring</Badge>
                      ) : slot.kind === 'library' ? (
                        <Badge tone="neutral">Library</Badge>
                      ) : null}
                      {slot.phase === 'now' ? (
                        <Badge tone="brand" icon={<Clock className="size-3" />}>
                          Now
                        </Badge>
                      ) : null}
                    </motion.li>
                  ))}
                </ul>
              )}
            </CardBody>
          </MotionCard>
        </>
      ) : (
        <MotionCard>
          <CardHeader title="The week" subtitle={section?.label ?? ''} />
          <CardBody className="pt-4">
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="grid min-w-[52rem] grid-cols-6 gap-2">
                {TEACHING_DAYS.map((d) => (
                  <div key={d}>
                    <p className="mb-2 text-center text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
                      {DAY_SHORT[d]}
                    </p>
                    <ul className="space-y-1.5">
                      {hoursFor(d)
                        .filter((s) => s.kind !== 'break' && s.kind !== 'lunch')
                        .map((slot) => (
                          <li
                            key={slot.id}
                            className={cn(
                              'rounded-lg border px-2 py-1.5',
                              slot.offeringId ? 'border-line bg-surface' : 'border-line bg-surface-2/60',
                            )}
                          >
                            <p className="truncate text-[11.5px] font-medium text-ink">
                              {slot.label}
                            </p>
                            <p className="tnum truncate text-[10.5px] text-ink-3">
                              {formatTime(slot.start)}
                            </p>
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
 * The hour scheduler.
 *
 * Assigning a member of staff to a paper happens once, on Academic Setup. This
 * is the other half: putting those papers into the week. The faculty follows
 * from the paper, so a cell asks only what is taught — and clash detection is
 * what earns the screen its place, since a double-booking is otherwise found on
 * Monday morning with two cohorts waiting for one person.
 */
function HourScheduler({ sectionId }: { sectionId: string }) {
  const db = useDatabase();
  const section = sectionById(db, sectionId);
  const offered = offeringsOf(db, sectionId);
  const balance = hourBalance(db, sectionId);
  const clashes = allClashes(db).filter((c) => c.sectionLabel === section?.label);

  const slots = db.timetable.filter((s) => s.sectionId === sectionId);
  const hourNumbers = [...new Set(slots.map((s) => s.hour))].sort((a, b) => a - b);

  if (!section) return null;

  if (hourNumbers.length === 0) {
    return (
      <MotionCard className="mb-5">
        <CardHeader
          title={`Build the week — ${section.label}`}
          subtitle="This cohort has no hours laid out yet"
        />
        <CardBody className="pt-4">
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="No week to edit yet"
            description="Lay out the college day for this cohort — breaks and lunch fixed, teaching hours empty — then choose what is taught in each."
            action={
              <Button
                onClick={() => {
                  const made = createBlankWeek(section.id);
                  toast.success(`Week laid out for ${section.label}`, {
                    description: `${made} hours ready to fill in.`,
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
        title={`Build the week — ${section.label}`}
        subtitle="Choose what is taught in each hour. The faculty comes from Academic Setup."
      />
      <CardBody className="pt-4">
        {/* Hours a week against what the syllabus allots each paper. */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {balance.map(({ offering, course, want, got }) => (
            <Badge
              key={offering.id}
              tone={got === want ? 'good' : got > want ? 'warning' : 'critical'}
            >
              {course!.title} {got}/{want}
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
                .map((c) => `${c.facultyName} is also with ${c.other}`)
                .join('; ')}
              {clashes.length > 3 ? '…' : ''}
            </span>
          </p>
        ) : null}

        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[48rem] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-14 text-left text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
                  Hour
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
              {hourNumbers.map((hour) => (
                <tr key={hour}>
                  <td className="tnum align-middle text-[12px] font-semibold text-ink-2">H{hour}</td>
                  {SCHED_DAYS.map((day) => {
                    const slot = slots.find((x) => x.day === day && x.hour === hour);

                    if (!slot) {
                      return (
                        <td
                          key={day}
                          className="rounded-lg bg-surface-2/50 px-2 py-2 text-center text-[11.5px] text-ink-3"
                        >
                          —
                        </td>
                      );
                    }

                    // Breaks and lunch are fixed by the college day, not chosen.
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
                    const faculty = userById(db, slot.facultyId ?? undefined);

                    return (
                      <td key={day} className="align-top">
                        <Select
                          aria-label={`${DAY_NAMES[day]} hour ${hour}`}
                          value={slot.offeringId ?? ''}
                          onChange={(e) => {
                            setTimetableSlot({
                              hourId: slot.id,
                              offeringId: e.target.value || null,
                            });
                            const name = e.target.value
                              ? (courseById(
                                  db,
                                  offered.find((o) => o.id === e.target.value)?.courseId,
                                )?.title ?? 'Paper')
                              : 'Free hour';
                            toast.success(`${DAY_SHORT[day]} H${hour}: ${name}`);
                          }}
                          className={cn(
                            'h-9 w-full text-[12.5px]',
                            clash && 'ring-2 ring-[--color-critical]/50',
                          )}
                        >
                          <option value="">Free hour</option>
                          {offered.map((o) => {
                            const course = courseById(db, o.courseId);
                            return (
                              <option key={o.id} value={o.id}>
                                {course?.title}
                                {course?.kind === 'practical' ? ' (practical)' : ''}
                              </option>
                            );
                          })}
                        </Select>

                        {slot.offeringId ? (
                          <p
                            className={cn(
                              'mt-1 truncate text-[11px]',
                              clash ? 'font-medium text-[--color-critical]' : 'text-ink-3',
                            )}
                            title={clash ? `Also with ${clash.sectionLabel}` : faculty?.name}
                          >
                            {clash ? `Clash · also ${clash.sectionLabel}` : (faculty?.name ?? '—')}
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
          A paper with no member of staff against it on Academic Setup leaves the hour unstaffed.
          Placing a practical puts the cohort in the matching laboratory with its first batch —
          adjust batches from the Laboratories page.
        </p>
      </CardBody>
    </MotionCard>
  );
}
