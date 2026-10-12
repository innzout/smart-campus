import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Percent,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  attendanceByCourse,
  attendanceTrend,
  condonationsFor,
  courseById,
  offeringsOf,
  overallAttendance,
  pendingCondonations,
  registerFor,
  sectionAttendance,
  sectionById,
  sectionLabel,
  sectionsForFaculty,
  studentsShortOfAttendance,
  userById,
} from '@/lib/queries';
import { decideCondonation, requestCondonation, saveAttendance } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/Table';
import { Avatar, EmptyState, PageHeader, Progress, Segmented } from '@/components/ui/misc';
import { TrendChart } from '@/components/charts/Charts';
import { RingGauge } from '@/components/charts/RingChart';
import { cn, num, todayISO } from '@/lib/utils';
import { ATTENDANCE_MINIMUM, CONDONATION_FLOOR } from '@/data/types';
import type { AttendanceStatus, User } from '@/data/types';

/**
 * Attendance, the way a college keeps it.
 *
 * The single most important difference from a school: attendance is counted
 * per paper, per hour. A student can be comfortable in four papers and barred
 * from the fifth, and the hall ticket is issued paper by paper. Showing one
 * blended percentage would hide the only number that decides anything.
 */

const STATUS_TONE: Record<AttendanceStatus, Tone> = {
  present: 'good',
  absent: 'critical',
  od: 'info',
  leave: 'warning',
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  od: 'On duty',
  leave: 'Leave',
};

/** How a percentage should read, against the university's own thresholds. */
function standing(percent: number) {
  if (percent >= ATTENDANCE_MINIMUM) return { tone: 'good' as Tone, label: 'Meets the requirement' };
  if (percent >= CONDONATION_FLOOR) {
    return { tone: 'warning' as Tone, label: 'Short — condonation possible' };
  }
  return { tone: 'critical' as Tone, label: 'Short — below the floor' };
}

/* ── what a student or a parent sees ──────────────────────────────────── */

function StudentAttendance({ student, forParent }: { student: User; forParent: boolean }) {
  const db = useDatabase();
  const can = useCan();
  const byCourse = attendanceByCourse(db, student.id);
  const overall = overallAttendance(db, student.id);
  const trend = attendanceTrend(db, student.id);
  const condonations = condonationsFor(db, student.id);
  const section = sectionById(db, student.sectionId);
  const [applying, setApplying] = useState<(typeof byCourse)[number] | null>(null);

  const short = byCourse.filter((c) => c.short);

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${student.name} · ${sectionLabel(db, student.sectionId)} · ${student.registerNo} · the university requires ${ATTENDANCE_MINIMUM}% in every paper`}
      />

      <StatGrid>
        <StatTile
          label="Overall"
          value={`${overall.percent}%`}
          note={`${overall.present} of ${overall.held} hours attended`}
          icon={Percent}
          tone={overall.percent >= ATTENDANCE_MINIMUM ? 'good' : 'warning'}
        />
        <StatTile
          label="Papers short"
          value={short.length}
          note={short.length ? 'Below 75% — examination at risk' : 'Every paper meets the requirement'}
          icon={short.length ? AlertTriangle : CheckCircle2}
          tone={short.length ? 'critical' : 'good'}
          delay={0.06}
        />
        <StatTile
          label="Hours held"
          value={num(overall.held)}
          note={`Across ${byCourse.length} papers this semester`}
          icon={CalendarCheck}
          delay={0.12}
        />
        <StatTile
          label="Condonation"
          value={condonations.length}
          note={
            condonations.some((c) => c.status === 'approved')
              ? 'One has been granted'
              : condonations.length
                ? 'With the examination cell'
                : 'None applied for'
          }
          icon={FileWarning}
          tone={condonations.length ? 'warning' : 'neutral'}
          delay={0.18}
        />
      </StatGrid>

      {short.length > 0 ? (
        <div className="mb-5 flex gap-3 rounded-2xl border border-[--color-critical]/35 bg-[--color-critical]/[0.05] px-4 py-3.5">
          <TriangleAlert className="mt-px size-4 shrink-0 text-[--color-critical]" aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">
              Short of attendance in {short.length} paper{short.length === 1 ? '' : 's'}.
            </span>{' '}
            A student below {ATTENDANCE_MINIMUM}% is not issued a hall ticket for that paper.
            Between {CONDONATION_FLOOR}% and {ATTENDANCE_MINIMUM}% condonation may be applied for
            with supporting documents; below {CONDONATION_FLOOR}% nothing can be done.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <MotionCard delay={0.1}>
          <CardHeader
            title="Paper by paper"
            subtitle="The figure that decides each hall ticket"
          />
          <CardBody className="pt-4">
            <ul className="space-y-2.5">
              {byCourse.map((row) => {
                const state = standing(row.percent);
                const applied = condonations.find((c) => c.offeringId === row.offering.id);
                return (
                  <li
                    key={row.offering.id}
                    className={cn(
                      'rounded-xl border px-3.5 py-3',
                      row.short
                        ? 'border-[--color-critical]/35 bg-[--color-critical]/[0.04]'
                        : 'border-line',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {row.course?.title ?? 'Paper'}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                          {row.course?.code} · {row.present} of {row.held} hours
                          {row.od ? ` · ${row.od} on duty` : ''}
                        </span>
                      </span>
                      <span className="tnum text-[15px] font-semibold text-ink">{row.percent}%</span>
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </div>

                    <Progress
                      value={row.percent}
                      tone={state.tone === 'good' ? 'good' : state.tone === 'warning' ? 'warning' : 'critical'}
                      className="mt-2.5 h-1.5"
                      label={`${row.course?.title} attendance`}
                    />

                    {row.short ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {applied ? (
                          <Badge
                            tone={
                              applied.status === 'approved'
                                ? 'good'
                                : applied.status === 'rejected'
                                  ? 'critical'
                                  : 'warning'
                            }
                          >
                            Condonation {applied.status}
                          </Badge>
                        ) : row.condonable && can('condonation.request') ? (
                          <Button size="sm" variant="secondary" onClick={() => setApplying(row)}>
                            Apply for condonation
                          </Button>
                        ) : (
                          <span className="text-[12px] text-[--color-critical]">
                            Below {CONDONATION_FLOOR}% — condonation is not permitted.
                          </span>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </MotionCard>

        <div className="space-y-5">
          <MotionCard delay={0.16}>
            <CardHeader title="Overall" subtitle="Every paper together" />
            <CardBody className="grid place-items-center pt-2 pb-5">
              <RingGauge
                value={overall.percent}
                size={168}
                label={`${overall.present} of ${overall.held} hours`}
                sublabel={`${ATTENDANCE_MINIMUM}% required`}
              />
            </CardBody>
          </MotionCard>

          <MotionCard delay={0.22}>
            <CardHeader title="Day by day" subtitle="Across all papers" />
            <CardBody className="pt-2">
              <TrendChart data={trend} unit="%" height={180} />
            </CardBody>
          </MotionCard>
        </div>
      </div>

      {applying ? (
        <CondonationDialog
          studentId={student.id}
          offeringId={applying.offering.id}
          courseTitle={applying.course?.title ?? 'this paper'}
          percent={applying.percent}
          semester={section?.semester ?? 1}
          forParent={forParent}
          onClose={() => setApplying(null)}
        />
      ) : null}
    </>
  );
}

function CondonationDialog({
  studentId,
  offeringId,
  courseTitle,
  percent,
  semester,
  forParent,
  onClose,
}: {
  studentId: string;
  offeringId: string;
  courseTitle: string;
  percent: number;
  semester: number;
  forParent: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <Modal
      open
      onClose={onClose}
      title={`Condonation — ${courseTitle}`}
      description={`Attendance stands at ${percent}%. Condonation is granted at the Principal's discretion on payment of the prescribed fee.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={reason.trim().length < 15}
            onClick={() => {
              requestCondonation({
                studentId,
                offeringId,
                semester,
                percent,
                reason: reason.trim(),
              });
              toast.success('Application submitted', {
                description: 'The examination cell has been notified.',
              });
              onClose();
            }}
          >
            Submit application
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Reason"
          required
          htmlFor="cr"
          hint="Medical records, an on-duty letter or a bereavement certificate should be produced at the office."
        >
          <Textarea
            id="cr"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              forParent
                ? 'My ward was hospitalised for ten days with dengue. Discharge summary enclosed.'
                : 'I was hospitalised for ten days with dengue. Discharge summary enclosed.'
            }
          />
        </Field>
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
          A fee of ₹500 is charged if condonation is granted, and is added to the fee account. It is
          not payable unless the application succeeds.
        </p>
      </div>
    </Modal>
  );
}

/* ── marking the register, one hour of one paper ──────────────────────── */

function MarkRegister() {
  const db = useDatabase();
  const me = useCurrentUser();
  const mySections = sectionsForFaculty(db, me.id);

  const [sectionId, setSectionId] = useState(mySections[0]?.id ?? db.sections[0]?.id ?? '');
  const offerings = offeringsOf(db, sectionId);
  const [offeringId, setOfferingId] = useState(offerings[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [hour, setHour] = useState(1);

  const offering = offerings.find((o) => o.id === offeringId) ?? offerings[0];
  const course = courseById(db, offering?.courseId);
  // Only the students enrolled sit this paper — an elective is not the cohort.
  const roll = (offering?.enrolledIds ?? [])
    .map((id) => userById(db, id))
    .filter((u): u is User => !!u)
    .sort((a, b) => (a.rollNo ?? 0) - (b.rollNo ?? 0));

  const existing = offering ? registerFor(db, offering.id, date, hour) : [];
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});

  const statusOf = (studentId: string): AttendanceStatus =>
    draft[studentId] ?? existing.find((a) => a.studentId === studentId)?.status ?? 'present';

  const marked = existing.length > 0;
  const absent = roll.filter((s) => statusOf(s.id) === 'absent').length;

  const cycle = (studentId: string) => {
    const order: AttendanceStatus[] = ['present', 'absent', 'od', 'leave'];
    const next = order[(order.indexOf(statusOf(studentId)) + 1) % order.length]!;
    setDraft((d) => ({ ...d, [studentId]: next }));
  };

  return (
    <>
      <PageHeader
        title="Mark the register"
        subtitle={`${sectionLabel(db, sectionId)} · ${course?.title ?? 'paper'} · hour ${hour}`}
      />

      <MotionCard className="mb-5">
        <CardBody className="grid gap-3 pt-5 sm:grid-cols-4">
          <Field label="Cohort" htmlFor="ms">
            <Select
              id="ms"
              value={sectionId}
              onChange={(e) => {
                setSectionId(e.target.value);
                const first = offeringsOf(db, e.target.value)[0];
                setOfferingId(first?.id ?? '');
                setDraft({});
              }}
            >
              {(mySections.length ? mySections : db.sections).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Paper" htmlFor="mo">
            <Select
              id="mo"
              value={offeringId}
              onChange={(e) => {
                setOfferingId(e.target.value);
                setDraft({});
              }}
            >
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {courseById(db, o.courseId)?.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="md">
            <Input
              id="md"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDraft({});
              }}
            />
          </Field>
          <Field label="Hour" htmlFor="mh">
            <Select
              id="mh"
              value={String(hour)}
              onChange={(e) => {
                setHour(Number(e.target.value));
                setDraft({});
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                <option key={h} value={h}>
                  Hour {h}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </MotionCard>

      <MotionCard delay={0.1}>
        <CardHeader
          title={`${roll.length} on the roll`}
          subtitle={
            marked
              ? 'Already marked for this hour — saving again will overwrite it'
              : 'Tap a student to cycle present, absent, on duty, leave'
          }
          action={
            <Button
              icon={<ClipboardCheck className="size-4" />}
              disabled={!offering || roll.length === 0}
              onClick={() => {
                const statuses: Record<string, AttendanceStatus> = {};
                for (const s of roll) statuses[s.id] = statusOf(s.id);
                saveAttendance({
                  offeringId: offering!.id,
                  date,
                  hour,
                  statuses,
                  markedBy: me.id,
                });
                setDraft({});
                toast.success('Register saved', {
                  description: absent
                    ? `${absent} marked absent. Their parents have been notified.`
                    : 'Full attendance.',
                });
              }}
            >
              Save register
            </Button>
          }
        />
        <CardBody className="pt-4">
          {roll.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title="Nobody enrolled in this paper"
              description="An elective has no roll until students opt into it."
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {roll.map((s) => {
                const status = statusOf(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => cycle(s.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        status === 'absent'
                          ? 'border-[--color-critical]/40 bg-[--color-critical]/[0.06]'
                          : status === 'od'
                            ? 'border-[#2a78d6]/40 bg-[#2a78d6]/[0.06]'
                            : status === 'leave'
                              ? 'border-[#fab219]/45 bg-[#fab219]/[0.08]'
                              : 'border-line bg-surface hover:border-line-strong',
                      )}
                    >
                      <span className="tnum min-w-6 shrink-0 text-[11.5px] font-semibold text-ink-3">
                        {s.rollNo}
                      </span>
                      <Avatar name={s.name} hue={s.avatarHue} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                        {s.name}
                      </span>
                      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </MotionCard>
    </>
  );
}

/* ── the whole college, for the office and the examination cell ───────── */

function CollegeAttendance() {
  const db = useDatabase();
  const me = useCurrentUser();
  const can = useCan();
  const [tab, setTab] = useState<'short' | 'condonation' | 'cohorts'>('short');

  const short = studentsShortOfAttendance(db);
  const pending = pendingCondonations(db);
  const [sectionId, setSectionId] = useState(db.sections[0]?.id ?? '');
  const cohort = sectionAttendance(db, sectionId);

  const columns: Column<(typeof short)[number] & { id: string }>[] = [
    {
      key: 'student',
      header: 'Student',
      sortBy: (r) => r.student.name,
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.student.name} hue={r.student.avatarHue} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{r.student.name}</span>
            <span className="block truncate text-[11.5px] text-ink-3">{r.student.registerNo}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'section',
      header: 'Cohort',
      hideOnMobile: true,
      sortBy: (r) => r.section?.label ?? '',
      cell: (r) => r.section?.label ?? '—',
    },
    {
      key: 'paper',
      header: 'Worst paper',
      cell: (r) => (
        <span>
          <span className="block truncate text-[13px] text-ink">{r.worst.course?.title}</span>
          <span className="block text-[11.5px] text-ink-3">
            {r.worst.present} of {r.worst.held} hours
          </span>
        </span>
      ),
    },
    {
      key: 'percent',
      header: 'Attendance',
      align: 'right',
      sortBy: (r) => r.worst.percent,
      cell: (r) => {
        const state = standing(r.worst.percent);
        return (
          <span className="flex flex-col items-end gap-1">
            <span className="tnum font-semibold text-ink">{r.worst.percent}%</span>
            <Badge tone={state.tone}>{r.shortCount} paper{r.shortCount === 1 ? '' : 's'}</Badge>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${ATTENDANCE_MINIMUM}% is required in every paper before a hall ticket is issued`}
        action={
          <Segmented
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'short', label: `Short (${short.length})` },
              { value: 'condonation', label: `Condonation (${pending.length})` },
              { value: 'cohorts', label: 'Cohorts' },
            ]}
          />
        }
      />

      <StatGrid>
        <StatTile
          label="Students short"
          value={short.length}
          note="In at least one paper"
          icon={AlertTriangle}
          tone={short.length ? 'critical' : 'good'}
        />
        <StatTile
          label="Below the floor"
          value={short.filter((r) => r.worst.percent < CONDONATION_FLOOR).length}
          note={`Under ${CONDONATION_FLOOR}% — condonation not permitted`}
          icon={FileWarning}
          tone="critical"
          delay={0.06}
        />
        <StatTile
          label="Condonation pending"
          value={pending.length}
          note={can('condonation.approve') ? 'Awaiting your orders' : 'With the examination cell'}
          icon={CalendarCheck}
          tone={pending.length ? 'warning' : 'good'}
          delay={0.12}
        />
        <StatTile
          label="Students on roll"
          value={num(db.users.filter((u) => u.roles.includes('student')).length)}
          note={`${db.sections.length} cohorts`}
          icon={Users}
          delay={0.18}
        />
      </StatGrid>

      {tab === 'short' ? (
        <MotionCard delay={0.1}>
          <CardHeader
            title="Short of attendance"
            subtitle="The list the examination cell works from before issuing hall tickets"
          />
          <CardBody className="pt-4">
            <DataTable
              rows={short.map((r) => ({ ...r, id: r.student.id }))}
              columns={columns}
              initialSort={{ key: 'percent', dir: 'asc' }}
              empty={
                <EmptyState
                  icon={<CheckCircle2 className="size-6" />}
                  title="Nobody is short"
                  description="Every student meets the requirement in every paper."
                />
              }
            />
          </CardBody>
        </MotionCard>
      ) : null}

      {tab === 'condonation' ? (
        <MotionCard delay={0.1}>
          <CardHeader
            title="Condonation applications"
            subtitle="Granted at the Principal’s discretion on payment of the prescribed fee"
          />
          <CardBody className="pt-4">
            {pending.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="size-6" />}
                title="Nothing pending"
                description="Every application has been decided."
              />
            ) : (
              <ul className="space-y-2">
                {pending.map((c) => {
                  const student = userById(db, c.studentId);
                  const course = courseById(
                    db,
                    db.offerings.find((o) => o.id === c.offeringId)?.courseId,
                  );
                  return (
                    <li key={c.id} className="rounded-xl border border-line px-3.5 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {student ? (
                          <Avatar name={student.name} hue={student.avatarHue} size="md" />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-ink">
                            {student?.name ?? 'Student'}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                            {student?.registerNo} · {course?.title} · semester {c.semester}
                          </span>
                        </span>
                        <Badge tone={c.percent >= CONDONATION_FLOOR ? 'warning' : 'critical'}>
                          {c.percent}%
                        </Badge>
                      </div>
                      <p className="mt-2 text-[12.5px] text-ink-2">{c.reason}</p>
                      {can('condonation.approve') ? (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={c.percent < CONDONATION_FLOOR}
                            onClick={() => {
                              decideCondonation(c.id, 'approved', me.id);
                              toast.success('Condonation granted', {
                                description: `₹${c.fee} has been added to the fee account.`,
                              });
                            }}
                          >
                            {c.percent < CONDONATION_FLOOR ? 'Below the floor' : 'Grant'}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              decideCondonation(c.id, 'rejected', me.id);
                              toast.success('Application refused');
                            }}
                          >
                            Refuse
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </MotionCard>
      ) : null}

      {tab === 'cohorts' ? (
        <MotionCard delay={0.1}>
          <CardHeader
            title="By cohort"
            subtitle="Every student's worst paper, which is the one that bars them"
            action={
              <Select
                aria-label="Cohort"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="h-9 min-w-[12rem] text-[13px]"
              >
                {db.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            }
          />
          <CardBody className="pt-4">
            <ul className="space-y-2">
              {cohort.map((row) => (
                <li
                  key={row.student.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-2.5"
                >
                  <span className="tnum min-w-6 shrink-0 text-[11.5px] font-semibold text-ink-3">
                    {row.student.rollNo}
                  </span>
                  <Avatar name={row.student.name} hue={row.student.avatarHue} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {row.student.name}
                    </span>
                    <span className="block truncate text-[11.5px] text-ink-3">
                      {row.student.registerNo}
                    </span>
                  </span>
                  <span className="w-28 shrink-0">
                    <Progress
                      value={row.percent}
                      tone={row.shortIn ? 'critical' : 'good'}
                      className="h-1.5"
                      label="Attendance"
                    />
                  </span>
                  <span className="tnum min-w-12 shrink-0 text-right text-[13px] font-semibold text-ink">
                    {row.percent}%
                  </span>
                  {row.shortIn ? (
                    <Badge tone="critical">
                      short in {row.shortIn}
                    </Badge>
                  ) : (
                    <Badge tone="good">clear</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </MotionCard>
      ) : null}
    </>
  );
}

export default function Attendance() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const can = useCan();

  if (user.roles.includes('parent') || user.roles.includes('student')) {
    if (!subject) {
      return (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No student linked to this account"
          description="Please contact the college office."
        />
      );
    }
    return <StudentAttendance student={subject} forParent={user.roles.includes('parent')} />;
  }

  // Someone who marks the register but cannot see the whole college gets the
  // register itself; the office and the examination cell get the overview.
  if (can('attendance.mark') && !can('attendance.view.college')) return <MarkRegister />;
  if (can('attendance.view.college')) return <CollegeAttendance />;
  return <MarkRegister />;
}
