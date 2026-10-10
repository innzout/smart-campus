import { useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, Clock, MapPin, User as UserIcon } from 'lucide-react';
import { useAuth, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { classById, classesForTeacher, teacherDay, timetableForClass } from '@/lib/queries';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { useNow } from '@/lib/clock';
import { DAY_NAMES, DAY_SHORT, TEACHING_DAYS, cn, formatTime } from '@/lib/utils';

export default function Timetable() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const db = useDatabase();
  const clock = useNow();
  const today = clock.getDay();

  const isStaff = user.role !== 'parent' && user.role !== 'student';
  const myClasses = isStaff ? classesForTeacher(db, user.id) : [];

  const [classId, setClassId] = useState(
    subject?.classId ?? db.classes.find((c) => c.classTeacherId === user.id)?.id ?? myClasses[0]?.id ?? db.classes[0]!.id,
  );
  // On a Sunday there is nothing to show, so open on Monday instead.
  const [day, setDay] = useState<number>(today === 0 ? 1 : today);
  const [view, setView] = useState<'day' | 'week'>('day');

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
            {isStaff && myClasses.length > 1 ? (
              <Segmented size="sm" value={classId} onChange={setClassId} options={myClasses.map((c) => ({ value: c.id, label: c.label }))} />
            ) : null}
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
              ]}
            />
          </div>
        }
      />

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
