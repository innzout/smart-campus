import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Award,
  BedDouble,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  IndianRupee,
  Percent,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  academicStanding,
  applicationsFor,
  assignmentsForStudent,
  collectionSummary,
  duesBySection,
  facultyDay,
  hostelFor,
  hostelOccupancy,
  menteesOf,
  overallAttendance,
  pendingCondonations,
  placementSummary,
  sectionById,
  sectionLabel,
  sectionRank,
  sectionsForFaculty,
  studentsOf,
  studentsShortOfAttendance,
  theCollege,
  userById,
  visibleCirculars,
} from '@/lib/queries';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { Avatar, EmptyState, PageHeader, Progress } from '@/components/ui/misc';
import { BarList } from '@/components/charts/Charts';
import { RingGauge } from '@/components/charts/RingChart';
import { useClock, useNow } from '@/lib/clock';
import { formatTime, money, num, relativeDay } from '@/lib/utils';
import { ATTENDANCE_MINIMUM } from '@/data/types';
import type { User } from '@/data/types';

/* ── a student, or a parent looking at one ───────────────────────────── */

function StudentDashboard({ student, forParent }: { student: User; forParent: boolean }) {
  const db = useDatabase();
  const clock = useClock();
  const now = useNow();
  const day = now.getDay();

  const attendance = overallAttendance(db, student.id);
  const standing = academicStanding(db, student.id);
  const rank = sectionRank(db, student.id);
  const assignments = assignmentsForStudent(db, student.id);
  const pending = assignments.filter((a) => a.state !== 'marked' && a.state !== 'submitted');
  const section = sectionById(db, student.sectionId);
  const today = db.timetable
    .filter((s) => s.sectionId === student.sectionId && s.day === day && s.offeringId)
    .sort((a, b) => a.hour - b.hour);
  const fees = db.fees.filter((f) => f.studentId === student.id);
  const outstanding = fees.reduce((t, f) => t + (f.total - f.paid), 0);
  const offers = applicationsFor(db, student.id).filter((a) => a.application.stage === 'selected');
  const hostel = hostelFor(db, student.id);
  const circulars = visibleCirculars(db).slice(0, 4);

  const who = forParent ? student.name.split(' ')[0] : 'you';

  return (
    <>
      <PageHeader
        title={`${clock.greeting}${forParent ? '' : `, ${student.name.split(' ')[0]}`}`}
        subtitle={`${student.name} · ${sectionLabel(db, student.sectionId)} · ${student.registerNo} · semester ${section?.semester ?? ''}`}
      />

      <StatGrid>
        <StatTile
          label="Attendance"
          value={`${attendance.percent}%`}
          note={
            attendance.shortIn
              ? `Short in ${attendance.shortIn} paper${attendance.shortIn === 1 ? '' : 's'}`
              : `Every paper above ${ATTENDANCE_MINIMUM}%`
          }
          icon={Percent}
          tone={attendance.shortIn ? 'critical' : 'good'}
          onClick={undefined}
        />
        <StatTile
          label="CGPA"
          value={standing.cgpa ? standing.cgpa.toFixed(2) : '—'}
          note={rank ? `Rank ${rank.rank} of ${rank.of}` : 'No results yet'}
          icon={Award}
          tone={standing.cgpa >= 7 ? 'good' : standing.cgpa ? 'warning' : 'neutral'}
          delay={0.06}
        />
        <StatTile
          label="Arrears"
          value={standing.arrears}
          note={standing.arrears ? 'Blocks most recruiters' : 'Nothing outstanding'}
          icon={standing.arrears ? TriangleAlert : CheckCircle2}
          tone={standing.arrears ? 'critical' : 'good'}
          delay={0.12}
        />
        <StatTile
          label="Fees outstanding"
          value={money(outstanding)}
          note={outstanding ? 'Hall tickets are withheld on dues' : 'Nothing due'}
          icon={Wallet}
          tone={outstanding ? 'warning' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      {/* The three things actually needing action, named plainly. */}
      {attendance.shortIn || standing.arrears || outstanding || pending.length ? (
        <MotionCard delay={0.08} className="mb-5">
          <CardHeader
            title="Needs attention"
            subtitle={forParent ? `What ${who} must act on` : 'What to deal with'}
          />
          <CardBody className="space-y-2 pt-4">
            {attendance.shortIn ? (
              <Link
                to="/attendance"
                className="flex items-center gap-3 rounded-xl border border-[--color-critical]/35 bg-[--color-critical]/[0.05] px-3.5 py-3 transition-colors hover:border-[--color-critical]/50"
              >
                <AlertTriangle className="size-4 shrink-0 text-[--color-critical]" aria-hidden />
                <span className="min-w-0 flex-1 text-[13px] text-ink-2">
                  <span className="font-semibold text-ink">
                    Short of attendance in {attendance.shortIn} paper
                    {attendance.shortIn === 1 ? '' : 's'}.
                  </span>{' '}
                  A hall ticket is not issued below {ATTENDANCE_MINIMUM}%.
                </span>
              </Link>
            ) : null}
            {standing.arrears ? (
              <Link
                to="/results"
                className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 transition-colors hover:border-line-strong"
              >
                <GraduationCap className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1 text-[13px] text-ink-2">
                  <span className="font-semibold text-ink">
                    {standing.arrears} arrear{standing.arrears === 1 ? '' : 's'} to clear:
                  </span>{' '}
                  {standing.arrearPapers.map((c) => c.title).join(', ')}
                </span>
              </Link>
            ) : null}
            {outstanding ? (
              <Link
                to="/fees"
                className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 transition-colors hover:border-line-strong"
              >
                <IndianRupee className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1 text-[13px] text-ink-2">
                  <span className="font-semibold text-ink">{money(outstanding)} outstanding.</span>{' '}
                  Payable online or at the office counter.
                </span>
              </Link>
            ) : null}
            {pending.length ? (
              <Link
                to="/assignments"
                className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 transition-colors hover:border-line-strong"
              >
                <ClipboardList className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1 text-[13px] text-ink-2">
                  <span className="font-semibold text-ink">
                    {pending.length} assignment{pending.length === 1 ? '' : 's'} to submit.
                  </span>{' '}
                  Next due {relativeDay(pending[0]!.assignment.dueOn)}.
                </span>
              </Link>
            ) : null}
          </CardBody>
        </MotionCard>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <MotionCard delay={0.12}>
            <CardHeader
              title="Today"
              subtitle={day === 0 ? 'Sunday — no classes' : `${today.length} hours scheduled`}
            />
            <CardBody className="pt-4">
              {today.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="size-6" />}
                  title={day === 0 ? 'Sunday' : 'Nothing scheduled today'}
                />
              ) : (
                <ul className="divide-y divide-line">
                  {today.map((slot, i) => {
                    const course = db.courses.find(
                      (c) => c.id === db.offerings.find((o) => o.id === slot.offeringId)?.courseId,
                    );
                    return (
                      <motion.li
                        key={slot.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <span className="tnum min-w-16 shrink-0 whitespace-nowrap text-[11.5px] font-medium text-ink-3">
                          {formatTime(slot.start)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                          {course?.title ?? slot.title}
                        </span>
                        <span className="shrink-0 text-[11.5px] text-ink-3">
                          {userById(db, slot.facultyId ?? undefined)?.name ?? ''}
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </MotionCard>

          <MotionCard delay={0.18}>
            <CardHeader title="Notices" subtitle="From the college office" />
            <CardBody className="pt-4">
              <ul className="divide-y divide-line">
                {circulars.map((c) => (
                  <li key={c.id} className="py-2.5">
                    <Link to="/circulars" className="group block">
                      <p className="flex items-center gap-2 text-[13px] font-medium text-ink group-hover:text-brand-600 dark:group-hover:text-brand-300">
                        {c.pinned ? <Badge tone="brand">Pinned</Badge> : null}
                        <span className="truncate">{c.title}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[11.5px] text-ink-3">
                        {c.category} · {relativeDay(c.postedOn)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </MotionCard>
        </div>

        <div className="space-y-5">
          <MotionCard delay={0.14}>
            <CardHeader title="Attendance" subtitle="Across every paper" />
            <CardBody className="grid place-items-center pt-2 pb-5">
              <RingGauge
                value={attendance.percent}
                size={150}
                label={`${attendance.present} of ${attendance.held} hours`}
                sublabel={`${ATTENDANCE_MINIMUM}% required`}
              />
            </CardBody>
          </MotionCard>

          {offers.length > 0 ? (
            <MotionCard delay={0.2}>
              <CardHeader title="Placement" subtitle="Offers in hand" />
              <CardBody className="space-y-2 pt-4">
                {offers.map(({ application, drive, company }) => (
                  <div
                    key={application.id}
                    className="rounded-xl border border-[--color-good]/35 bg-[--color-good]/[0.05] px-3.5 py-3"
                  >
                    <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      <Briefcase className="size-4 shrink-0 text-[--color-good]" aria-hidden />
                      {company?.name}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-2">
                      {drive?.role} · ₹{drive?.packageLpa} LPA · {drive?.location}
                    </p>
                  </div>
                ))}
              </CardBody>
            </MotionCard>
          ) : null}

          {hostel ? (
            <MotionCard delay={0.24}>
              <CardHeader title="Hostel" subtitle={hostel.block?.name} />
              <CardBody className="pt-4">
                <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
                  <BedDouble className="size-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">
                      Room {hostel.room?.number}
                    </span>
                    <span className="block text-[11.5px] text-ink-3">
                      {hostel.room?.capacity}-sharing · warden {hostel.warden?.name ?? '—'}
                    </span>
                  </span>
                  <Badge tone={hostel.allotment.status === 'allotted' ? 'good' : 'warning'}>
                    {hostel.allotment.status}
                  </Badge>
                </div>
              </CardBody>
            </MotionCard>
          ) : null}
        </div>
      </div>
    </>
  );
}

/* ── a member of faculty ─────────────────────────────────────────────── */

function FacultyDashboard() {
  const db = useDatabase();
  const me = useCurrentUser();
  const clock = useClock();
  const now = useNow();
  const day = now.getDay();

  const hours = facultyDay(db, me.id, day);
  const mySections = sectionsForFaculty(db, me.id);
  const myOfferings = db.offerings.filter((o) => o.facultyId === me.id);
  const mentees = menteesOf(db, me.id);
  const atRisk = mentees.filter((m) => m.attendance.shortIn > 0 || m.standing.arrears > 0);
  const toMark = db.assignments
    .filter((a) => myOfferings.some((o) => o.id === a.offeringId))
    .filter((a) =>
      db.assignmentStatus.some((s) => s.assignmentId === a.id && s.submittedOn && s.marks == null),
    );

  return (
    <>
      <PageHeader
        title={`${clock.greeting}, ${me.name.split('. ').at(-1)}`}
        subtitle={`${me.roleName} · ${db.departments.find((d) => d.id === me.departmentId)?.name ?? ''} · ${clock.todayLabel}`}
      />

      <StatGrid>
        <StatTile
          label="Hours today"
          value={hours.length}
          note={hours[0] ? `First at ${formatTime(hours[0].start)}` : 'Nothing scheduled'}
          icon={Clock}
        />
        <StatTile
          label="Papers"
          value={myOfferings.length}
          note={`Across ${mySections.length} cohorts`}
          icon={GraduationCap}
          delay={0.06}
        />
        <StatTile
          label="Mentees"
          value={mentees.length}
          note={atRisk.length ? `${atRisk.length} need attention` : 'All progressing'}
          icon={Users}
          tone={atRisk.length ? 'warning' : 'good'}
          delay={0.12}
        />
        <StatTile
          label="To mark"
          value={toMark.length}
          note={toMark.length ? 'Assignments submitted, not yet marked' : 'Nothing waiting'}
          icon={ClipboardList}
          tone={toMark.length ? 'warning' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <MotionCard delay={0.1}>
          <CardHeader title="Your day" subtitle={clock.todayLabel} />
          <CardBody className="pt-4">
            {hours.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-6" />}
                title={day === 0 ? 'Sunday' : 'No hours today'}
              />
            ) : (
              <ul className="space-y-2">
                {hours.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3"
                  >
                    <span className="tnum min-w-16 shrink-0 whitespace-nowrap text-[12.5px] font-semibold text-ink">
                      {formatTime(h.start)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">
                        {h.course}
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-3">
                        {h.sectionName} · {h.room}
                      </span>
                    </span>
                    {h.kind === 'lab' ? <Badge tone="info">Practical</Badge> : null}
                    {h.kind === 'mentoring' ? <Badge tone="brand">Mentoring</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader
            title="Mentees needing attention"
            subtitle="Short of attendance, or carrying arrears"
          />
          <CardBody className="pt-4">
            {atRisk.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="size-6" />}
                title="Nobody at risk"
                description="Every mentee is attending and passing."
              />
            ) : (
              <ul className="space-y-2">
                {atRisk.slice(0, 8).map((m) => (
                  <li
                    key={m.student.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-2.5"
                  >
                    <Avatar name={m.student.name} hue={m.student.avatarHue} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {m.student.name}
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-3">
                        {m.section?.label} · {m.student.registerNo}
                      </span>
                    </span>
                    {m.attendance.shortIn ? (
                      <Badge tone="critical">{m.attendance.percent}%</Badge>
                    ) : null}
                    {m.standing.arrears ? (
                      <Badge tone="warning">{m.standing.arrears} arrears</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </MotionCard>
      </div>
    </>
  );
}

/* ── the office, the Principal, the trust ────────────────────────────── */

function OfficeDashboard() {
  const db = useDatabase();
  const can = useCan();
  const me = useCurrentUser();
  const clock = useClock();
  const college = theCollege(db);

  const students = studentsOf(db);
  const staff = db.users.filter((u) => !!u.employeeId);
  const collection = collectionSummary(db);
  const short = studentsShortOfAttendance(db);
  const condonations = pendingCondonations(db);
  const placements = placementSummary(db);
  const hostel = hostelOccupancy(db);
  const dues = duesBySection(db);

  return (
    <>
      <PageHeader
        title={`${clock.greeting}, ${me.name.split('. ').at(-1)}`}
        subtitle={`${college.shortName} · ${college.affiliatedTo} · ${college.academicYear}, ${college.currentTerm} semester`}
      />

      <StatGrid>
        <StatTile
          label="Students on roll"
          value={num(students.length)}
          note={`${db.programmes.length} programmes · ${db.sections.length} cohorts`}
          icon={Users}
        />
        <StatTile
          label="Fees collected"
          value={money(collection.paid)}
          note={`${collection.percent}% of ${money(collection.billed)} billed`}
          icon={Wallet}
          tone={collection.percent >= 70 ? 'good' : 'warning'}
          delay={0.06}
        />
        <StatTile
          label="Short of attendance"
          value={short.length}
          note={condonations.length ? `${condonations.length} condonation requests` : 'In at least one paper'}
          icon={AlertTriangle}
          tone={short.length ? 'critical' : 'good'}
          delay={0.12}
        />
        <StatTile
          label="Placed"
          value={`${placements.percent}%`}
          note={`${placements.placed} of ${placements.eligible} final-year students`}
          icon={Briefcase}
          tone={placements.percent >= 50 ? 'good' : 'warning'}
          delay={0.18}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-2">
        {can('report.view') ? (
        <MotionCard delay={0.1}>
          <CardHeader title="Outstanding by cohort" subtitle="Where to chase" />
          <CardBody className="pt-2">
            {dues.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="size-6" />} title="Nothing outstanding" />
            ) : (
              <BarList data={dues.slice(0, 8)} valueLabel="Outstanding" height={240} />
            )}
          </CardBody>
        </MotionCard>
        ) : null}

        <MotionCard delay={0.16}>
          <CardHeader title="The college at a glance" subtitle="Figures worth knowing today" />
          <CardBody className="space-y-2 pt-4">
            {[
              ['Staff on roll', `${staff.length} · ${db.departments.length} departments`, Users],
              [
                'Hostel occupancy',
                `${hostel.filled} of ${hostel.capacity} beds · ${hostel.percent}% full`,
                BedDouble,
              ],
              [
                'Placements',
                `${placements.offers} offers · highest ₹${placements.highest} LPA · average ₹${placements.average.toFixed(1)} LPA`,
                Briefcase,
              ],
              [
                'Scholarships',
                `${money(collection.scholarships)} in concessions granted`,
                IndianRupee,
              ],
              [
                'Examinations',
                `${db.exams.filter((e) => !e.published).length} not yet published`,
                GraduationCap,
              ],
            ].map(([label, value, Icon]) => {
              const Lucide = Icon as typeof Users;
              return (
                <div
                  key={label as string}
                  className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5"
                >
                  <Lucide className="size-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">
                      {label as string}
                    </span>
                    <span className="block truncate text-[11.5px] text-ink-3">
                      {value as string}
                    </span>
                  </span>
                </div>
              );
            })}
          </CardBody>
        </MotionCard>
      </div>

      <MotionCard delay={0.22} className="mt-5">
        <CardHeader
          title="Short of attendance"
          subtitle="The list the examination cell works from before issuing hall tickets"
          action={<LinkButton to="/attendance" size="sm" variant="secondary">Open</LinkButton>}
        />
        <CardBody className="pt-4">
          {short.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-6" />}
              title="Nobody is short"
              description="Every student meets the requirement in every paper."
            />
          ) : (
            <ul className="space-y-2">
              {short.slice(0, 10).map((r) => (
                <li
                  key={r.student.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-2.5"
                >
                  <Avatar name={r.student.name} hue={r.student.avatarHue} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {r.student.name}
                    </span>
                    <span className="block truncate text-[11.5px] text-ink-3">
                      {r.section?.label} · {r.worst.course?.title}
                    </span>
                  </span>
                  <span className="w-28 shrink-0">
                    <Progress
                      value={r.worst.percent}
                      tone="critical"
                      className="h-1.5"
                      label="Attendance"
                    />
                  </span>
                  <span className="tnum min-w-12 shrink-0 text-right text-[13px] font-semibold text-[--color-critical]">
                    {r.worst.percent}%
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

export default function Dashboard() {
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
    return <StudentDashboard student={subject} forParent={user.roles.includes('parent')} />;
  }

  // Someone who teaches but cannot see the whole college gets the teaching
  // view; the office, the Principal and the trust get the overview.
  if (!can('attendance.view.college') && (can('attendance.mark') || can('result.enter'))) {
    return <FacultyDashboard />;
  }
  return <OfficeDashboard />;
}
