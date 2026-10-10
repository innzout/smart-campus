import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Banknote,
  Bus,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Megaphone,
  PartyPopper,
  UserCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import { useAuth, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  attendanceFor,
  attendanceTrend,
  classById,
  classLabel,
  classRank,
  classesForTeacher,
  collectionSummary,
  defaulters,
  duesByClass,
  feeSummary,
  homeworkForStudent,
  latestPublishedExam,
  reportCard,
  reportTotals,
  schoolAttendanceOn,
  studentsInClass,
  studentsNeedingAttention,
  studentsOf,
  summariseAttendance,
  teacherDay,
  theSchool,
  timetableForClass,
  transportFor,
  upcomingEvents,
  visibleCirculars,
} from '@/lib/queries';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar, EmptyState, PageHeader, Progress } from '@/components/ui/misc';
import { LinkButton } from '@/components/ui/Button';
import { BarList, ColumnChart, TrendChart } from '@/components/charts/Charts';
import { RingGauge } from '@/components/charts/RingChart';
import {
  ATTENDANCE_THRESHOLD,
  DAY_NAMES,
  cn,
  formatDate,
  formatTime,
  greetingFor,
  longDate,
  money,
  moneyCompact,
  num,
  pct,
  relativeDay,
  todayISO,
} from '@/lib/utils';
import { useNow } from '@/lib/clock';
import type { User } from '@/data/types';

function useClock() {
  const clock = useNow();
  return {
    greeting: greetingFor(clock),
    todayLabel: longDate(clock),
    dayIndex: clock.getDay(),
  };
}

function AlertRow({
  tone,
  title,
  body,
  to,
}: {
  tone: 'critical' | 'warning' | 'info';
  title: string;
  body: string;
  to: string;
}) {
  const tones = {
    critical: 'bg-[--color-critical]/8 ring-[--color-critical]/25',
    warning: 'bg-[--color-warning]/12 ring-[--color-warning]/30',
    info: 'bg-[--s1]/8 ring-[--s1]/22',
  };
  return (
    <Link
      to={to}
      className={cn(
        'flex items-start gap-3 rounded-xl px-3.5 py-3 ring-1 ring-inset transition-transform hover:translate-x-0.5',
        tones[tone],
      )}
    >
      <AlertTriangle
        className={cn(
          'mt-0.5 size-4 shrink-0',
          tone === 'critical' ? 'text-[--color-critical]' : tone === 'warning' ? 'text-[#8a5d00] dark:text-[#f5c451]' : 'text-[--s1]',
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-2">{body}</span>
      </span>
      <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
    </Link>
  );
}

/* ── parent / student ──────────────────────────────────────────────────── */

function ChildDashboard({ student, forParent }: { student: User; forParent: boolean }) {
  const db = useDatabase();
  const { greeting, todayLabel, dayIndex } = useClock();
  const user = useCurrentUser();

  const cls = classById(db, student.classId);
  const attendance = summariseAttendance(attendanceFor(db, student.id));
  const trend = attendanceTrend(db, student.id);
  const fees = feeSummary(db, student.id);
  const homework = homeworkForStudent(db, student);
  const pending = homework.filter((h) => !h.done);
  const dueSoon = pending.filter((h) => h.daysLeft <= 1);
  const slots = cls ? timetableForClass(db, cls.id, dayIndex).filter((s) => s.kind === 'period') : [];
  const exam = latestPublishedExam(db, student);
  const report = exam ? reportTotals(reportCard(db, student.id, exam.id)) : null;
  const rank = exam ? classRank(db, student, exam.id) : null;
  const bus = transportFor(db, student.id);
  const recentAbsences = attendanceFor(db, student.id)
    .filter((a) => a.status === 'absent' || a.status === 'leave')
    .slice(-3)
    .reverse();
  const events = upcomingEvents(db).slice(0, 3);
  const pinned = visibleCirculars(db).filter((c) => c.pinned).slice(0, 2);

  const firstName = student.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={
          <>
            {greeting}, {forParent ? user.name.split(' ').at(-1) : firstName}
            <span className="ml-2 inline-block align-middle">👋</span>
          </>
        }
        subtitle={
          forParent
            ? `${student.name} · Class ${cls?.label} · Roll ${student.rollNo} — ${todayLabel}`
            : `Class ${cls?.label} · Roll ${student.rollNo} — ${todayLabel}`
        }
      />

      <StatGrid>
        <StatTile
          label="Attendance"
          value={pct(attendance.percent, 1)}
          note={`${attendance.present + attendance.late} of ${attendance.total} days present`}
          icon={UserCheck}
          tone={attendance.percent < ATTENDANCE_THRESHOLD ? 'critical' : 'good'}
          trend={trend.map((t) => t.percent)}
        />
        <StatTile
          label="Fees outstanding"
          value={moneyCompact(fees.pending)}
          note={
            fees.nextDue
              ? `${fees.nextDue.head} due ${relativeDay(fees.nextDue.dueOn)}`
              : 'Fully paid — thank you'
          }
          icon={WalletCards}
          tone={fees.overdueAmount > 0 ? 'critical' : fees.pending > 0 ? 'warning' : 'good'}
          delay={0.06}
        />
        <StatTile
          label="Homework pending"
          value={pending.length}
          note={dueSoon.length ? `${dueSoon.length} due today or tomorrow` : 'Nothing urgent'}
          icon={ClipboardList}
          tone={dueSoon.length ? 'warning' : 'neutral'}
          delay={0.12}
        />
        <StatTile
          label={exam ? exam.shortName : 'Report card'}
          value={report ? pct(report.percent, 1) : '—'}
          note={rank?.rank ? `Rank ${rank.rank} of ${rank.outOf} in class` : 'Not published yet'}
          icon={GraduationCap}
          tone={report && report.percent >= 60 ? 'good' : 'neutral'}
          delay={0.18}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <MotionCard delay={0.1}>
          <CardHeader
            title="Needs your attention"
            subtitle="The things worth knowing today"
          />
          <CardBody className="space-y-2.5 pt-4">
            {fees.overdueAmount > 0 ? (
              <AlertRow
                tone="critical"
                title={`${money(fees.overdueAmount)} is overdue`}
                body={`${fees.overdue.map((f) => f.head).join(', ')}. You can pay online from the Fees page.`}
                to="/fees"
              />
            ) : null}
            {fees.nextDue && fees.overdueAmount === 0 ? (
              <AlertRow
                tone="warning"
                title={`${fees.nextDue.head} — ${money(fees.nextDue.total - fees.nextDue.paid)}`}
                body={`Due ${relativeDay(fees.nextDue.dueOn)}. Pay online or at the school office.`}
                to="/fees"
              />
            ) : null}
            {attendance.percent < ATTENDANCE_THRESHOLD ? (
              <AlertRow
                tone="warning"
                title={`Attendance is ${pct(attendance.percent, 1)}`}
                body={`${firstName} has missed ${attendance.absent} day${attendance.absent === 1 ? '' : 's'} this term. The school expects at least ${ATTENDANCE_THRESHOLD}%.`}
                to="/attendance"
              />
            ) : null}
            {dueSoon.map((h) => (
              <AlertRow
                key={h.homework.id}
                tone={h.daysLeft < 0 ? 'critical' : 'warning'}
                title={h.homework.title}
                body={`${h.subject?.name} — ${h.daysLeft < 0 ? 'overdue' : `due ${relativeDay(h.homework.dueOn)}`}.`}
                to="/homework"
              />
            ))}
            {pinned.map((c) => (
              <AlertRow key={c.id} tone="info" title={c.title} body={`${c.body.slice(0, 110)}…`} to="/circulars" />
            ))}
            {fees.pending === 0 && attendance.percent >= ATTENDANCE_THRESHOLD && !dueSoon.length && !pinned.length ? (
              <EmptyState
                icon={<CheckCircle2 className="size-6" />}
                title="Nothing needs attention"
                description="Attendance, fees and homework are all in good shape."
              />
            ) : null}
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader
            title="Today at school"
            subtitle={DAY_NAMES[dayIndex]}
            action={
              <LinkButton to="/timetable" variant="ghost" size="sm" className="text-ink-3">
                Full week
              </LinkButton>
            }
          />
          <CardBody className="pt-4">
            {slots.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-6" />}
                title={dayIndex === 0 ? 'It’s Sunday — holiday' : 'No periods scheduled'}
              />
            ) : (
              <ol className="space-y-0">
                {slots.map((slot, i) => (
                  <motion.li
                    key={slot.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
                  >
                    <span className="tnum w-14 shrink-0 text-[11.5px] font-medium text-ink-3">
                      {formatTime(slot.start)}
                    </span>
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        slot.phase === 'now' ? 'bg-brand-500' : slot.phase === 'done' ? 'bg-line-strong' : 'bg-[--s1]',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[13px] font-medium', slot.phase === 'done' ? 'text-ink-3' : 'text-ink')}>
                        {slot.label}
                      </span>
                      <span className="block truncate text-[11px] text-ink-3">{slot.teacher}</span>
                    </span>
                    {slot.phase === 'now' ? <Badge tone="brand">Now</Badge> : null}
                  </motion.li>
                ))}
              </ol>
            )}
          </CardBody>
        </MotionCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <MotionCard delay={0.2}>
          <CardHeader
            title="Attendance"
            subtitle={`${attendance.absent} absent · ${attendance.leave} on leave · ${attendance.late} late`}
            action={
              <Link to="/attendance" className="text-[12.5px] font-medium text-brand-600 hover:underline dark:text-brand-300">
                Details
              </Link>
            }
          />
          <CardBody className="pt-4">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <RingGauge
                value={attendance.percent}
                label="This term"
                sublabel={`${attendance.present + attendance.late}/${attendance.total} days`}
                tone={attendance.percent < ATTENDANCE_THRESHOLD ? 'critical' : 'good'}
                size={148}
              />
              <div className="w-full min-w-0 flex-1">
                <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
                  Recent absences
                </p>
                {recentAbsences.length ? (
                  <ul className="space-y-1.5">
                    {recentAbsences.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="text-ink-2">{formatDate(a.date)}</span>
                        <Badge tone={a.status === 'absent' ? 'critical' : a.status === 'late' ? 'warning' : 'neutral'}>
                          {a.status === 'absent' ? 'Absent' : a.status === 'late' ? 'Late' : 'Leave'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12.5px] text-ink-3">No absences this term.</p>
                )}
              </div>
            </div>
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.24}>
          <CardHeader title="Attendance trend" subtitle="Month by month" />
          <CardBody className="pt-2">
            <TrendChart data={trend} label="Attendance" />
          </CardBody>
        </MotionCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <MotionCard delay={0.28}>
          <CardHeader
            title="Fees"
            subtitle={`${pct(fees.percent, 0)} of ${money(fees.total)} paid`}
            action={
              <Link to="/fees" className="text-[12.5px] font-medium text-brand-600 hover:underline dark:text-brand-300">
                Pay now
              </Link>
            }
          />
          <CardBody className="pt-4">
            <Progress value={fees.percent} tone={fees.pending ? 'warning' : 'good'} label="Fees paid" />
            <dl className="mt-4 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-3">Total for the year</dt>
                <dd className="tnum font-semibold text-ink">{money(fees.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-3">Paid</dt>
                <dd className="tnum font-semibold text-ink">{money(fees.paid)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <dt className="text-ink-3">Outstanding</dt>
                <dd className={cn('tnum font-semibold', fees.pending ? 'text-[--color-critical]' : 'text-ink-3')}>
                  {money(fees.pending)}
                </dd>
              </div>
            </dl>
            {bus ? (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3">
                <Bus className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 text-[12.5px] text-ink-2">
                  <span className="font-medium text-ink">{bus.route.name}</span> · {bus.stop}
                  {bus.pickup ? ` · pickup ${formatTime(bus.pickup.time)}` : ''}
                </span>
              </div>
            ) : null}
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.32}>
          <CardHeader
            title="Coming up"
            subtitle="School events"
            action={
              <Link to="/events" className="text-[12.5px] font-medium text-brand-600 hover:underline dark:text-brand-300">
                All events
              </Link>
            }
          />
          <CardBody className="space-y-2 pt-4">
            {events.map((e) => (
              <Link
                key={e.id}
                to="/events"
                className="flex min-w-0 items-center gap-3 rounded-xl border border-line px-3.5 py-3 transition-all hover:-translate-y-px hover:border-line-strong"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-center leading-none">
                  <span className="block text-[15px] font-semibold text-brand-600 dark:text-brand-300">
                    {e.date.slice(8)}
                  </span>
                  <span className="mt-0.5 block text-[9.5px] font-medium tracking-wide text-ink-3 uppercase">
                    {new Date(`${e.date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{e.title}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                    {formatTime(e.time)} · {e.venue}
                  </span>
                </span>
                <span className="shrink-0">
                  <Badge tone="neutral">{relativeDay(e.date)}</Badge>
                </span>
              </Link>
            ))}
          </CardBody>
        </MotionCard>
      </div>
    </>
  );
}

/* ── teacher ───────────────────────────────────────────────────────────── */

function TeacherDashboard() {
  const user = useCurrentUser();
  const db = useDatabase();
  const { greeting, todayLabel, dayIndex } = useClock();

  const myClasses = classesForTeacher(db, user.id);
  const classTeacherOf = db.classes.find((c) => c.classTeacherId === user.id);
  const periods = teacherDay(db, user.id, dayIndex);
  const today = todayISO();

  const roster = classTeacherOf ? studentsInClass(db, classTeacherOf.id) : [];
  const markedToday = classTeacherOf
    ? db.attendance.filter((a) => a.date === today && roster.some((s) => s.id === a.studentId))
    : [];
  const absentToday = markedToday.filter((a) => a.status === 'absent');
  const atRisk = classTeacherOf ? studentsNeedingAttention(db, classTeacherOf.id) : [];
  const classDues = classTeacherOf ? defaulters(db, classTeacherOf.id) : [];

  const pendingHomework = db.homework
    .filter((h) => h.assignedById === user.id && h.dueOn >= today)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name.replace(/^(Mrs|Mr|Ms)\.\s*/, '')}`}
        subtitle={`${user.designation ?? 'Teacher'}${classTeacherOf ? ` · Class teacher, ${classTeacherOf.label}` : ''} — ${todayLabel}`}
        action={
          classTeacherOf ? (
            <LinkButton to="/attendance" icon={<UserCheck className="size-4" />}>
              Mark attendance
            </LinkButton>
          ) : null
        }
      />

      <StatGrid>
        <StatTile
          label="Today's attendance"
          value={markedToday.length ? `${markedToday.length - absentToday.length}/${roster.length}` : 'Not marked'}
          note={markedToday.length ? `${absentToday.length} absent in ${classTeacherOf?.label}` : 'Tap to mark the register'}
          icon={UserCheck}
          tone={markedToday.length ? (absentToday.length > 3 ? 'warning' : 'good') : 'critical'}
        />
        <StatTile label="Periods today" value={periods.length} note={myClasses.map((c) => c.label).join(', ') || '—'} icon={CalendarDays} delay={0.06} />
        <StatTile label="Homework set" value={pendingHomework.length} note="Still due" icon={ClipboardList} delay={0.12} />
        <StatTile
          label="Attendance concerns"
          value={atRisk.length}
          note={`Below ${ATTENDANCE_THRESHOLD}% in ${classTeacherOf?.label ?? 'your class'}`}
          icon={AlertTriangle}
          tone={atRisk.length ? 'warning' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <MotionCard delay={0.1}>
          <CardHeader title="Your periods today" subtitle={DAY_NAMES[dayIndex]} />
          <CardBody className="pt-4">
            {periods.length === 0 ? (
              <EmptyState icon={<CalendarDays className="size-6" />} title="No periods today" />
            ) : (
              <ul className="space-y-2">
                {periods.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
                    <span className="tnum w-16 shrink-0 text-[12.5px] font-semibold text-ink">
                      {formatTime(p.start)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{p.subject}</span>
                      <span className="block text-[11.5px] text-ink-3">Period {p.period}</span>
                    </span>
                    <Badge tone="info">{p.className}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader
            title="Needs follow-up"
            subtitle={classTeacherOf ? `Class ${classTeacherOf.label}` : 'Your classes'}
          />
          <CardBody className="space-y-1 pt-3">
            {atRisk.slice(0, 5).map((r) => (
              <div key={r.student.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                <Avatar name={r.student.name} hue={r.student.avatarHue} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{r.student.name}</span>
                  <span className="block text-[11.5px] text-ink-3">
                    Roll {r.student.rollNo} · {r.summary.absent} days absent
                  </span>
                </span>
                <span className="tnum shrink-0 text-[13px] font-semibold text-[--color-critical]">
                  {pct(r.summary.percent, 0)}
                </span>
              </div>
            ))}
            {classDues.slice(0, 3).map((d) => (
              <div key={d.student.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                <Avatar name={d.student.name} hue={d.student.avatarHue} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{d.student.name}</span>
                  <span className="block text-[11.5px] text-ink-3">Fees overdue</span>
                </span>
                <span className="tnum shrink-0 text-[13px] font-semibold text-[--color-warning]">
                  {moneyCompact(d.amount)}
                </span>
              </div>
            ))}
            {!atRisk.length && !classDues.length ? (
              <EmptyState icon={<CheckCircle2 className="size-6" />} title="Nothing to follow up" />
            ) : null}
          </CardBody>
        </MotionCard>
      </div>
    </>
  );
}

/* ── office: correspondent, principal, accounts ───────────────────────── */

function OfficeDashboard() {
  const user = useCurrentUser();
  const db = useDatabase();
  const { greeting, todayLabel, dayIndex } = useClock();
  const isSunday = dayIndex === 0;
  const school = theSchool(db);

  const students = studentsOf(db);
  const staff = db.users.filter((u) => ['teacher', 'principal', 'admin', 'accountant'].includes(u.role));
  const today = todayISO();
  const todayAttendance = schoolAttendanceOn(db, today);
  const collection = collectionSummary(db);
  const topDefaulters = defaulters(db).slice(0, 6);
  const openRequests = db.requests.filter((r) => r.status !== 'resolved');

  const attendanceByClass = db.classes.map((cls) => {
    const ids = new Set(studentsInClass(db, cls.id).map((s) => s.id));
    const rows = db.attendance.filter((a) => ids.has(a.studentId));
    return {
      name: cls.label,
      value: Number(summariseAttendance(rows).percent.toFixed(1)),
      meta: `Class ${cls.label}`,
      color: summariseAttendance(rows).percent < ATTENDANCE_THRESHOLD ? 'var(--color-critical)' : 'var(--s1)',
    };
  });

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name.replace(/^(Mrs|Mr|Ms)\.\s*/, '')}`}
        subtitle={`${school.shortName} · ${school.academicYear} · Term ${school.currentTerm} — ${todayLabel}`}
        action={
          <>
            <LinkButton to="/circulars" variant="secondary" icon={<Megaphone className="size-4" />}>
              Post circular
            </LinkButton>
            <LinkButton to="/students" icon={<Users className="size-4" />}>
              Students
            </LinkButton>
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Present today"
          value={isSunday ? 'Holiday' : todayAttendance.total ? pct(todayAttendance.percent, 1) : '—'}
          note={
            isSunday
              ? 'Sunday — school is closed'
              : todayAttendance.total
                ? `${todayAttendance.absent} absent of ${todayAttendance.total}`
                : 'Registers not marked yet'
          }
          icon={UserCheck}
          tone={isSunday ? 'neutral' : todayAttendance.percent >= 90 ? 'good' : todayAttendance.total ? 'warning' : 'neutral'}
        />
        <StatTile label="Students on roll" value={num(students.length)} note={`${db.classes.length} classes · ${staff.length} staff`} icon={Users} delay={0.06} />
        <StatTile
          label="Fees collected"
          value={moneyCompact(collection.paid)}
          note={`${pct(collection.percent, 1)} of ${moneyCompact(collection.total)}`}
          icon={Banknote}
          tone="good"
          delay={0.12}
        />
        <StatTile
          label="Overdue fees"
          value={moneyCompact(collection.overdueAmount)}
          note={`${collection.defaulters} students to follow up`}
          icon={AlertTriangle}
          tone={collection.overdueAmount > 0 ? 'critical' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <MotionCard delay={0.1}>
          <CardHeader title="Attendance by class" subtitle="This term" />
          <CardBody className="pt-2">
            <ColumnChart
              data={attendanceByClass}
              unit="%"
              valueLabel="Attendance"
              maxValue={100}
              reference={{ value: ATTENDANCE_THRESHOLD, label: `${ATTENDANCE_THRESHOLD}% expected` }}
            />
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader title="Fee defaulters" subtitle="Largest outstanding first" />
          <CardBody className="space-y-1 pt-3">
            {topDefaulters.map((d) => (
              <div key={d.student.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                <Avatar name={d.student.name} hue={d.student.avatarHue} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{d.student.name}</span>
                  <span className="block truncate text-[11.5px] text-ink-3">
                    {classLabel(db, d.student.classId)} · {d.heads[0]}
                    {d.heads.length > 1 ? ` +${d.heads.length - 1}` : ''}
                  </span>
                </span>
                <span className="tnum shrink-0 text-[13px] font-semibold text-[--color-critical]">
                  {moneyCompact(d.amount)}
                </span>
              </div>
            ))}
            {!topDefaulters.length ? (
              <EmptyState icon={<CheckCircle2 className="size-6" />} title="No overdue fees" />
            ) : null}
          </CardBody>
        </MotionCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <MotionCard delay={0.2}>
          <CardHeader title="Outstanding by class" subtitle="Where to chase" />
          <CardBody className="pt-2">
            <BarList data={duesByClass(db)} valueLabel="Outstanding" height={230} />
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.24}>
          <CardHeader title="School activity" subtitle="Circulars, events and the help desk" />
          <CardBody className="space-y-2 pt-3">
            {visibleCirculars(db).slice(0, 3).map((c) => (
              <Link key={c.id} to="/circulars" className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                <Megaphone className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{c.title}</span>
                  <span className="block text-[11.5px] text-ink-3">
                    {c.category} · {c.acknowledgedBy.length} parents acknowledged
                  </span>
                </span>
              </Link>
            ))}
            {upcomingEvents(db).slice(0, 2).map((e) => (
              <Link key={e.id} to="/events" className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                <PartyPopper className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{e.title}</span>
                  <span className="block text-[11.5px] text-ink-3">{formatDate(e.date)} · {e.venue}</span>
                </span>
              </Link>
            ))}
            {openRequests.slice(0, 2).map((r) => (
              <Link key={r.id} to="/requests" className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                <BarChart3 className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{r.title}</span>
                  <span className="block text-[11.5px] text-ink-3">{r.ref} · {r.category}</span>
                </span>
              </Link>
            ))}
          </CardBody>
        </MotionCard>
      </div>
    </>
  );
}

export default function Dashboard() {
  const user = useCurrentUser();
  const { subject } = useAuth();

  if (user.role === 'parent' || user.role === 'student') {
    if (!subject) {
      return (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No student linked to this account"
          description="Please contact the school office."
        />
      );
    }
    return <ChildDashboard student={subject} forParent={user.role === 'parent'} />;
  }

  if (user.role === 'teacher') return <TeacherDashboard />;
  return <OfficeDashboard />;
}
