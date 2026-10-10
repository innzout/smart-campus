import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarCheck,
  CalendarX,
  Check,
  Clock,
  TriangleAlert,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  attendanceFor,
  attendanceOn,
  attendanceTrend,
  classById,
  classLabel,
  classesForTeacher,
  studentsInClass,
  studentsNeedingAttention,
  summariseAttendance,
} from '@/lib/queries';
import { saveAttendance } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, StatusPill } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/Table';
import { Avatar, EmptyState, PageHeader, Progress, Segmented } from '@/components/ui/misc';
import { TrendChart } from '@/components/charts/Charts';
import { RingGauge } from '@/components/charts/RingChart';
import { ATTENDANCE_THRESHOLD, cn, formatDate, num, pct, todayISO } from '@/lib/utils';
import type { AttendanceStatus, User } from '@/data/types';

const STATUS_TONE: Record<AttendanceStatus, 'good' | 'critical' | 'warning' | 'neutral'> = {
  present: 'good',
  absent: 'critical',
  late: 'warning',
  leave: 'neutral',
  holiday: 'neutral',
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  leave: 'Leave',
  holiday: 'Holiday',
};

/* ── the calendar strip a parent actually reads ───────────────────────── */

function AttendanceCalendar({ studentId }: { studentId: string }) {
  const db = useDatabase();
  const rows = attendanceFor(db, studentId);

  // Group by month so the strip reads like a school diary.
  const months = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.date.slice(0, 7);
      const bucket = map.get(key);
      if (bucket) bucket.push(r);
      else map.set(key, [r]);
    }
    return [...map.entries()].reverse();
  }, [rows]);

  const dot = (status: AttendanceStatus) =>
    status === 'present'
      ? 'bg-[--color-good]/85 text-white'
      : status === 'absent'
        ? 'bg-[--color-critical] text-white'
        : status === 'late'
          ? 'bg-[--color-warning] text-[#5a3d00]'
          : 'bg-line-strong text-ink-2';

  return (
    <div className="space-y-5">
      {months.map(([month, days]) => (
        <div key={month}>
          <p className="mb-2 text-[12px] font-semibold text-ink-2">
            {new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', {
              month: 'long',
              year: 'numeric',
            })}
            <span className="ml-2 font-normal text-ink-3">
              {pct(summariseAttendance(days).percent, 0)}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {days.map((d) => (
              <span
                key={d.id}
                title={`${formatDate(d.date)} — ${STATUS_LABEL[d.status]}${d.reason ? ` (${d.reason})` : ''}`}
                className={cn(
                  'grid size-8 place-items-center rounded-lg text-[11px] font-semibold',
                  dot(d.status),
                )}
              >
                {Number(d.date.slice(8))}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3">
        {(['present', 'absent', 'late', 'leave'] as AttendanceStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
            <span className={cn('size-2.5 rounded-[3px]', dot(s))} aria-hidden />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── parent / student view ────────────────────────────────────────────── */

function ChildAttendance({ student, forParent }: { student: User; forParent: boolean }) {
  const db = useDatabase();
  const summary = summariseAttendance(attendanceFor(db, student.id));
  const trend = attendanceTrend(db, student.id);
  const cls = classById(db, student.classId);
  const recent = attendanceFor(db, student.id)
    .filter((a) => a.status !== 'present')
    .slice(-8)
    .reverse();

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={
          forParent
            ? `${student.name} · Class ${cls?.label} · the school expects at least ${ATTENDANCE_THRESHOLD}%`
            : `Class ${cls?.label} · Roll ${student.rollNo}`
        }
      />

      <StatGrid>
        <StatTile
          label="Attendance this term"
          value={pct(summary.percent, 1)}
          note={`${summary.present + summary.late} of ${summary.total} school days`}
          icon={UserCheck}
          tone={summary.percent < ATTENDANCE_THRESHOLD ? 'critical' : 'good'}
          trend={trend.map((t) => t.percent)}
        />
        <StatTile label="Days absent" value={summary.absent} note="Without leave" icon={UserX} tone={summary.absent > 4 ? 'warning' : 'neutral'} delay={0.06} />
        <StatTile label="Approved leave" value={summary.leave} note="Informed in advance" icon={CalendarX} delay={0.12} />
        <StatTile label="Late arrivals" value={summary.late} note="Counted as present" icon={Clock} tone={summary.late > 3 ? 'warning' : 'neutral'} delay={0.18} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <MotionCard delay={0.1}>
          <CardHeader title="Overall" subtitle="Against the school's expectation" />
          <CardBody className="flex flex-col items-center pt-2">
            <RingGauge
              value={summary.percent}
              label="Attendance"
              sublabel={`${summary.present + summary.late}/${summary.total} days`}
              tone={summary.percent < ATTENDANCE_THRESHOLD ? 'critical' : 'good'}
              size={176}
            />
            <p className="mt-5 w-full rounded-xl bg-surface-2 px-4 py-3 text-center text-[12.5px] leading-relaxed text-ink-2">
              {summary.percent >= ATTENDANCE_THRESHOLD
                ? `${pct(summary.percent - ATTENDANCE_THRESHOLD, 1)} above the expected minimum.`
                : `${pct(ATTENDANCE_THRESHOLD - summary.percent, 1)} below the expected minimum — please speak to the class teacher.`}
            </p>
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader title="Month by month" subtitle="Attendance percentage" />
          <CardBody className="pt-2">
            <TrendChart data={trend} label="Attendance" height={250} />
          </CardBody>
        </MotionCard>
      </div>

      <MotionCard delay={0.2} className="mt-5">
        <CardHeader title="Day by day" subtitle="Every school day this term" />
        <CardBody className="pt-4">
          <AttendanceCalendar studentId={student.id} />
        </CardBody>
      </MotionCard>

      <MotionCard delay={0.24} className="mt-5">
        <CardHeader title="Days not present" subtitle="Most recent first" />
        <CardBody className="pt-4">
          {recent.length === 0 ? (
            <EmptyState icon={<CalendarCheck className="size-6" />} title="Present every day" description="A full attendance record this term." />
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">{formatDate(a.date)}</span>
                    <span className="block text-[11.5px] text-ink-3">
                      {a.reason ?? (a.status === 'absent' ? 'No reason recorded' : 'Arrived after assembly')}
                    </span>
                  </span>
                  <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </MotionCard>
    </>
  );
}

/* ── teacher: the daily register ──────────────────────────────────────── */

function ClassRegister() {
  const user = useCurrentUser();
  const db = useDatabase();
  const can = useCan();

  const myClasses = classesForTeacher(db, user.id);
  const [classId, setClassId] = useState(
    db.classes.find((c) => c.classTeacherId === user.id)?.id ?? myClasses[0]?.id ?? db.classes[0]!.id,
  );
  const [date, setDate] = useState(todayISO());
  const roster = studentsInClass(db, classId);

  // Start from what is already saved for the day, defaulting everyone present.
  const saved = attendanceOn(db, date, classId);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus> | null>(null);

  const statuses = useMemo(() => {
    if (draft) return draft;
    const base: Record<string, AttendanceStatus> = {};
    for (const s of roster) {
      base[s.id] = saved.find((a) => a.studentId === s.id)?.status ?? 'present';
    }
    return base;
  }, [draft, roster, saved]);

  const counts = {
    present: Object.values(statuses).filter((s) => s === 'present').length,
    absent: Object.values(statuses).filter((s) => s === 'absent').length,
    late: Object.values(statuses).filter((s) => s === 'late').length,
    leave: Object.values(statuses).filter((s) => s === 'leave').length,
  };

  const cycle = (id: string) => {
    const order: AttendanceStatus[] = ['present', 'absent', 'late', 'leave'];
    setDraft({
      ...statuses,
      [id]: order[(order.indexOf(statuses[id] ?? 'present') + 1) % order.length]!,
    });
  };

  const submit = () => {
    saveAttendance({ date, classId, statuses, markedBy: user.id });
    setDraft(null);
    toast.success('Register saved', {
      description: `${classLabel(db, classId)} · ${counts.present + counts.late} present, ${counts.absent} absent. Parents of absentees have been notified.`,
    });
  };

  const atRisk = studentsNeedingAttention(db, classId);
  const alreadyMarked = saved.length > 0;

  return (
    <>
      <PageHeader
        title="Attendance register"
        subtitle="Tap a student to change their status. Everyone starts present."
        action={
          <Segmented
            size="sm"
            value={classId}
            onChange={setClassId}
            options={myClasses.map((c) => ({ value: c.id, label: c.label }))}
          />
        }
      />

      <StatGrid>
        <StatTile label="On roll" value={roster.length} note={`Class ${classLabel(db, classId)}`} icon={UserCheck} />
        <StatTile label="Present" value={counts.present + counts.late} note={`${counts.late} arrived late`} icon={Check} tone="good" delay={0.06} />
        <StatTile label="Absent" value={counts.absent} note="Parents are notified on save" icon={UserX} tone={counts.absent ? 'critical' : 'good'} delay={0.12} />
        <StatTile label="Needs follow-up" value={atRisk.length} note={`Below ${ATTENDANCE_THRESHOLD}% this term`} icon={TriangleAlert} tone={atRisk.length ? 'warning' : 'good'} delay={0.18} />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader
          title={`Register — ${formatDate(date)}`}
          subtitle={alreadyMarked ? 'Already marked today; saving again will update it.' : 'Not yet marked for this day.'}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => {
                  setDate(e.target.value);
                  setDraft(null);
                }}
                className="h-9 rounded-xl border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-500"
                aria-label="Register date"
              />
              {can('attendance.mark') ? <Button size="sm" onClick={submit}>Save register</Button> : null}
            </div>
          }
        />
        <CardBody className="pt-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {roster.map((s) => {
              const status = statuses[s.id] ?? 'present';
              return (
                <button
                  key={s.id}
                  onClick={() => cycle(s.id)}
                  disabled={!can('attendance.mark')}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-default',
                    status === 'present' && 'border-line bg-surface hover:border-line-strong',
                    status === 'absent' && 'border-[--color-critical]/45 bg-[--color-critical]/8',
                    status === 'late' && 'border-[--color-warning]/50 bg-[--color-warning]/10',
                    status === 'leave' && 'border-line-strong bg-surface-2',
                  )}
                >
                  <span className="tnum w-6 shrink-0 text-[11.5px] font-semibold text-ink-3">
                    {s.rollNo}
                  </span>
                  <Avatar name={s.name} hue={s.avatarHue} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                    {s.name}
                  </span>
                  <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                </button>
              );
            })}
          </div>
        </CardBody>
      </MotionCard>

      {atRisk.length ? (
        <MotionCard delay={0.16} className="mt-5">
          <CardHeader
            title="Students to follow up"
            subtitle={`Below ${ATTENDANCE_THRESHOLD}% attendance this term`}
          />
          <CardBody className="pt-4">
            <ul className="divide-y divide-line">
              {atRisk.map((r) => (
                <li key={r.student.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={r.student.name} hue={r.student.avatarHue} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{r.student.name}</span>
                    <span className="block text-[11.5px] text-ink-3">
                      Roll {r.student.rollNo} · {r.summary.absent} absent, {r.summary.leave} on leave
                    </span>
                  </span>
                  <span className="w-28 shrink-0">
                    <Progress value={r.summary.percent} tone="critical" className="h-1.5" label="Attendance" />
                  </span>
                  <span className="tnum w-12 shrink-0 text-right text-[13px] font-semibold text-[--color-critical]">
                    {pct(r.summary.percent, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </MotionCard>
      ) : null}
    </>
  );
}

/* ── office: whole-school view ────────────────────────────────────────── */

function SchoolAttendance() {
  const db = useDatabase();
  const today = todayISO();

  const rows = db.classes.map((cls) => {
    const ids = new Set(studentsInClass(db, cls.id).map((s) => s.id));
    const term = summariseAttendance(db.attendance.filter((a) => ids.has(a.studentId)));
    const todayRows = db.attendance.filter((a) => a.date === today && ids.has(a.studentId));
    return {
      id: cls.id,
      label: cls.label,
      teacher: db.users.find((u) => u.id === cls.classTeacherId)?.name ?? '—',
      strength: ids.size,
      todayMarked: todayRows.length > 0,
      todayAbsent: todayRows.filter((a) => a.status === 'absent').length,
      percent: term.percent,
    };
  });

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'label', header: 'Class', sortBy: (r) => r.label, cell: (r) => <span className="font-semibold text-ink">{r.label}</span> },
    { key: 'teacher', header: 'Class teacher', hideOnMobile: true, sortBy: (r) => r.teacher, cell: (r) => r.teacher },
    { key: 'strength', header: 'On roll', align: 'right', sortBy: (r) => r.strength, cell: (r) => <span className="tnum">{r.strength}</span> },
    {
      key: 'today',
      header: 'Today',
      align: 'center',
      cell: (r) =>
        r.todayMarked ? (
          <Badge tone={r.todayAbsent ? 'warning' : 'good'}>{r.todayAbsent} absent</Badge>
        ) : (
          <Badge tone="critical">Not marked</Badge>
        ),
    },
    {
      key: 'percent',
      header: 'Term attendance',
      align: 'right',
      sortBy: (r) => r.percent,
      cell: (r) => (
        <span className={cn('tnum font-semibold', r.percent < ATTENDANCE_THRESHOLD ? 'text-[--color-critical]' : 'text-ink')}>
          {pct(r.percent, 1)}
        </span>
      ),
    },
  ];

  const school = summariseAttendance(db.attendance);
  const todayAll = summariseAttendance(db.attendance.filter((a) => a.date === today));
  const unmarked = rows.filter((r) => !r.todayMarked);
  const atRisk = studentsNeedingAttention(db);

  return (
    <>
      <PageHeader title="Attendance" subtitle="Whole-school attendance and the classes that need chasing." />

      <StatGrid>
        <StatTile label="Present today" value={todayAll.total ? pct(todayAll.percent, 1) : '—'} note={todayAll.total ? `${todayAll.absent} absent of ${todayAll.total}` : 'Registers not marked'} icon={UserCheck} tone={todayAll.total ? (todayAll.percent >= 90 ? 'good' : 'warning') : 'neutral'} />
        <StatTile label="Term attendance" value={pct(school.percent, 1)} note="All classes, this term" icon={CalendarCheck} delay={0.06} />
        <StatTile label="Registers not marked" value={unmarked.length} note={unmarked.map((r) => r.label).join(', ') || 'All marked'} icon={CalendarX} tone={unmarked.length ? 'critical' : 'good'} delay={0.12} />
        <StatTile label="Students to follow up" value={num(atRisk.length)} note={`Below ${ATTENDANCE_THRESHOLD}%`} icon={TriangleAlert} tone={atRisk.length ? 'warning' : 'good'} delay={0.18} />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader title="By class" subtitle="Sort any column" />
        <CardBody className="pt-4">
          <DataTable columns={columns} rows={rows} initialSort={{ key: 'percent', dir: 'asc' }} />
        </CardBody>
      </MotionCard>

      <MotionCard delay={0.16} className="mt-5">
        <CardHeader title="Students needing follow-up" subtitle="Lowest attendance first" />
        <CardBody className="pt-4">
          {atRisk.length === 0 ? (
            <EmptyState icon={<CalendarCheck className="size-6" />} title="Every student is above the expected minimum" />
          ) : (
            <ul className="divide-y divide-line">
              {atRisk.slice(0, 12).map((r) => (
                <li key={r.student.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={r.student.name} hue={r.student.avatarHue} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{r.student.name}</span>
                    <span className="block text-[11.5px] text-ink-3">
                      {classLabel(db, r.student.classId)} · roll {r.student.rollNo} · {r.summary.absent} absent
                    </span>
                  </span>
                  <StatusPill status="at-risk" />
                  <span className="tnum w-12 shrink-0 text-right text-[13px] font-semibold text-[--color-critical]">
                    {pct(r.summary.percent, 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </MotionCard>
    </>
  );
}

export default function Attendance() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const can = useCan();

  if (user.role === 'parent' || user.role === 'student') {
    if (!subject) return <EmptyState icon={<UserX className="size-6" />} title="No student linked to this account" />;
    return <ChildAttendance student={subject} forParent={user.role === 'parent'} />;
  }
  // Office roles get the whole-school picture; class teachers get the register.
  if (can('attendance.view.school')) return <SchoolAttendance />;
  if (can('attendance.mark')) return <ClassRegister />;
  return <SchoolAttendance />;
}
