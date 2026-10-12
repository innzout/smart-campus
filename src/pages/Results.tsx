import { useState } from 'react';
import { toast } from 'sonner';
import {
  Award,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Send,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  academicStanding,
  ciaFor,
  coursePassRates,
  courseById,
  offeringsOf,
  sectionById,
  sectionLabel,
  sectionRank,
  sectionsForFaculty,
  studentsInSection,
  transcript,
  userById,
} from '@/lib/queries';
import { publishResults, saveInternalMarks, setElective } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Avatar, EmptyState, PageHeader, Progress } from '@/components/ui/misc';
import { BarList } from '@/components/charts/Charts';
import { cn, formatDate } from '@/lib/utils';
import type { CiaComponent, User } from '@/data/types';

/**
 * Results, the way a university records them.
 *
 * A college student does not have a percentage and a rank in class — they have
 * a grade and grade points per paper, a GPA for the semester, a CGPA across the
 * degree, and arrears. The arrears are the part that actually governs a life:
 * they decide whether a student may sit a placement drive, and whether they
 * graduate with their batch.
 */

const GRADE_TONE = (grade: string): Tone =>
  grade === 'RA' ? 'critical' : grade === 'B' ? 'warning' : grade === 'O' ? 'good' : 'info';

/* ── a student's own record ───────────────────────────────────────────── */

function StudentResults({ student }: { student: User }) {
  const db = useDatabase();
  const canChoose = useCan()('result.view.self');
  const electives = offeringsOf(db, student.sectionId ?? '').filter((o) => o.isElective);
  const semesters = transcript(db, student.id);
  const standing = academicStanding(db, student.id);
  const rank = sectionRank(db, student.id);
  const section = sectionById(db, student.sectionId);
  const [open, setOpen] = useState(semesters[0]?.semester ?? 1);

  // What is being studied now has no end-semester result yet, only internals.
  const current = offeringsOf(db, student.sectionId ?? '')
    .filter((o) => o.enrolledIds.includes(student.id))
    .map((offering) => ({
      offering,
      course: courseById(db, offering.courseId),
      cia: ciaFor(db, student.id, offering.id),
    }));

  if (semesters.length === 0 && current.length === 0) {
    return (
      <EmptyState
        icon={<GraduationCap className="size-6" />}
        title="No results yet"
        description="Results appear here once the first end-semester examination has been published."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Results"
        subtitle={`${student.name} · ${sectionLabel(db, student.sectionId)} · ${student.registerNo}`}
      />

      <StatGrid>
        <StatTile
          label="CGPA"
          value={standing.cgpa.toFixed(2)}
          note={`Across ${standing.semestersCompleted} completed semester${standing.semestersCompleted === 1 ? '' : 's'}`}
          icon={Award}
          tone={standing.cgpa >= 7 ? 'good' : standing.cgpa >= 5 ? 'warning' : 'critical'}
        />
        <StatTile
          label="Arrears"
          value={standing.arrears}
          note={
            standing.arrears
              ? 'Must be cleared to graduate — and they bar most recruiters'
              : 'No paper outstanding'
          }
          icon={standing.arrears ? TriangleAlert : CheckCircle2}
          tone={standing.arrears ? 'critical' : 'good'}
          delay={0.06}
        />
        <StatTile
          label="Credits earned"
          value={standing.creditsEarned}
          note="Counting only papers passed"
          icon={BookOpen}
          delay={0.12}
        />
        <StatTile
          label="Rank in cohort"
          value={rank ? `${rank.rank} of ${rank.of}` : '—'}
          note="By CGPA"
          icon={TrendingUp}
          delay={0.18}
        />
      </StatGrid>

      {standing.arrears > 0 ? (
        <div className="mb-5 flex gap-3 rounded-2xl border border-[--color-critical]/35 bg-[--color-critical]/[0.05] px-4 py-3.5">
          <TriangleAlert className="mt-px size-4 shrink-0 text-[--color-critical]" aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">
              {standing.arrears} paper{standing.arrears === 1 ? '' : 's'} to be cleared:
            </span>{' '}
            {standing.arrearPapers.map((c) => c.title).join(', ')}. Arrear examinations are held
            alongside the end-semester examinations; registration is through the examination cell.
          </p>
        </div>
      ) : null}

      {electives.length > 1 && canChoose ? (
        <MotionCard delay={0.08} className="mb-5">
          <CardHeader
            title="Your elective"
            subtitle="Two students in the same cohort do not necessarily sit the same papers"
          />
          <CardBody className="pt-4">
            <Field label="Elective for this semester" htmlFor="el">
              <Select
                id="el"
                value={electives.find((e) => e.enrolledIds.includes(student.id))?.id ?? ''}
                onChange={(e) => {
                  setElective(student.id, e.target.value);
                  toast.success('Elective changed', {
                    description: 'Your attendance and internal marks follow the paper you chose.',
                  });
                }}
              >
                {electives.map((o) => (
                  <option key={o.id} value={o.id}>
                    {courseById(db, o.courseId)?.title}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="mt-2 text-[11.5px] text-ink-3">
              A change is only possible before the internal assessment begins. After that it is a
              written request to the Head of Department.
            </p>
          </CardBody>
        </MotionCard>
      ) : null}

      {current.length > 0 ? (
        <MotionCard delay={0.1} className="mb-5">
          <CardHeader
            title={`Semester ${section?.semester ?? ''} — internal assessment so far`}
            subtitle="Continuous assessment counts towards the final mark; the end-semester paper is still to come"
          />
          <CardBody className="pt-4">
            <ul className="space-y-2">
              {current.map(({ offering, course, cia }) => (
                <li
                  key={offering.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">
                      {course?.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                      {course?.code} · {course?.credits} credits ·{' '}
                      {userById(db, offering.facultyId)?.name ?? '—'}
                    </span>
                  </span>
                  {cia.outOf > 0 ? (
                    <>
                      <span className="w-28 shrink-0">
                        <Progress
                          value={Math.round((cia.scored / cia.outOf) * 100)}
                          tone={cia.scored / cia.outOf >= 0.5 ? 'good' : 'warning'}
                          className="h-1.5"
                          label="Internal assessment"
                        />
                      </span>
                      <span className="tnum shrink-0 text-[13px] font-semibold text-ink">
                        {cia.scored}/{cia.outOf}
                      </span>
                    </>
                  ) : (
                    <Badge tone="neutral">Not yet assessed</Badge>
                  )}
                  {cia.pending > 0 ? (
                    <Badge tone="warning">{cia.pending} to come</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </MotionCard>
      ) : null}

      {semesters.length > 0 ? (
        <MotionCard delay={0.16}>
          <CardHeader
            title="Transcript"
            subtitle="Every completed semester, newest first"
            action={
              <Select
                aria-label="Semester"
                value={String(open)}
                onChange={(e) => setOpen(Number(e.target.value))}
                className="h-9 min-w-[11rem] text-[13px]"
              >
                {semesters.map((s) => (
                  <option key={s.semester} value={s.semester}>
                    Semester {s.semester} · GPA {s.gpa.toFixed(2)}
                  </option>
                ))}
              </Select>
            }
          />
          <CardBody className="pt-4">
            {semesters
              .filter((s) => s.semester === open)
              .map((sem) => (
                <div key={sem.semester}>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Badge tone={sem.gpa >= 7 ? 'good' : sem.gpa >= 5 ? 'warning' : 'critical'}>
                      GPA {sem.gpa.toFixed(2)}
                    </Badge>
                    <Badge tone="neutral">
                      {sem.earned} of {sem.credits} credits earned
                    </Badge>
                    {sem.arrears > 0 ? (
                      <Badge tone="critical">{sem.arrears} arrear{sem.arrears === 1 ? '' : 's'}</Badge>
                    ) : (
                      <Badge tone="good">All cleared</Badge>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {sem.lines.map(({ course, result }) => (
                      <li
                        key={result.id}
                        className={cn(
                          'flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-3',
                          result.status === 'arrear'
                            ? 'border-[--color-critical]/35 bg-[--color-critical]/[0.04]'
                            : 'border-line',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-ink">
                            {course?.title ?? 'Paper'}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                            {course?.code} · {result.credits} credits · internal {result.cia}, external{' '}
                            {result.ese ?? '—'}
                            {result.attempt > 1 ? ` · attempt ${result.attempt}` : ''}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-[13px] text-ink-2">{result.total}</span>
                        <Badge tone={GRADE_TONE(result.grade)}>
                          {result.grade} · {result.gradePoint}
                        </Badge>
                        {result.status === 'arrear' ? (
                          <Badge tone="critical">Reappear</Badge>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </CardBody>
        </MotionCard>
      ) : null}
    </>
  );
}

/* ── entering internal marks ──────────────────────────────────────────── */

const COMPONENTS: CiaComponent[] = ['CIA-1', 'CIA-2', 'Model', 'Assignment'];

function MarksEntry() {
  const db = useDatabase();
  const me = useCurrentUser();
  const can = useCan();
  const mySections = sectionsForFaculty(db, me.id);

  const [sectionId, setSectionId] = useState(mySections[0]?.id ?? db.sections[0]?.id ?? '');
  const offerings = offeringsOf(db, sectionId);
  const [offeringId, setOfferingId] = useState(offerings[0]?.id ?? '');
  const [component, setComponent] = useState<CiaComponent>('CIA-1');

  const offering = offerings.find((o) => o.id === offeringId) ?? offerings[0];
  const course = courseById(db, offering?.courseId);
  const roll = (offering?.enrolledIds ?? [])
    .map((id) => userById(db, id))
    .filter((u): u is User => !!u)
    .sort((a, b) => (a.rollNo ?? 0) - (b.rollNo ?? 0));

  // Each component is marked out of its own maximum, which varies by paper.
  const maxMarks = course?.ciaMax === 40 ? 15 : 10;
  const [draft, setDraft] = useState<Record<string, string>>({});

  const existingFor = (studentId: string) =>
    db.internalMarks.find(
      (m) =>
        m.studentId === studentId && m.offeringId === (offering?.id ?? '') && m.component === component,
    );

  const unpublished = db.exams.filter((e) => !e.published);
  const passRates = coursePassRates(db, sectionById(db, sectionId)?.semester ?? 1);

  return (
    <>
      <PageHeader
        title="Results"
        subtitle={`${sectionLabel(db, sectionId)} · ${course?.title ?? 'paper'} · ${component}`}
        action={
          can('result.publish') && unpublished.length > 0 ? (
            <Button
              icon={<Send className="size-4" />}
              onClick={() => {
                publishResults(unpublished[0]!.id);
                toast.success(`${unpublished[0]!.name} published`, {
                  description: 'Every student and parent affected has been notified.',
                });
              }}
            >
              Publish {unpublished[0]!.shortName}
            </Button>
          ) : null
        }
      />

      <MotionCard className="mb-5">
        <CardBody className="grid gap-3 pt-5 sm:grid-cols-3">
          <Select
            aria-label="Cohort"
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setOfferingId(offeringsOf(db, e.target.value)[0]?.id ?? '');
              setDraft({});
            }}
          >
            {(mySections.length ? mySections : db.sections).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Paper"
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
          <Select
            aria-label="Component"
            value={component}
            onChange={(e) => {
              setComponent(e.target.value as CiaComponent);
              setDraft({});
            }}
          >
            {COMPONENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </CardBody>
      </MotionCard>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <MotionCard delay={0.1}>
          <CardHeader
            title={`${component} — out of ${maxMarks}`}
            subtitle={`${roll.length} students enrolled in this paper`}
            action={
              can('result.enter') ? (
                <Button
                  size="sm"
                  disabled={!offering}
                  onClick={() => {
                    const marks: Record<string, number | null> = {};
                    for (const s of roll) {
                      const raw = draft[s.id] ?? existingFor(s.id)?.marks?.toString() ?? '';
                      const value = raw === '' ? null : Number(raw);
                      marks[s.id] =
                        value == null || Number.isNaN(value)
                          ? null
                          : Math.max(0, Math.min(maxMarks, value));
                    }
                    saveInternalMarks({ offeringId: offering!.id, component, marks, maxMarks });
                    setDraft({});
                    toast.success(`${component} saved for ${roll.length} students`);
                  }}
                >
                  Save marks
                </Button>
              ) : null
            }
          />
          <CardBody className="pt-4">
            {roll.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="size-6" />}
                title="Nobody enrolled in this paper"
                description="An elective has no roll until students opt into it."
              />
            ) : (
              <ul className="space-y-1.5">
                {roll.map((s) => {
                  const existing = existingFor(s.id);
                  const value = draft[s.id] ?? existing?.marks?.toString() ?? '';
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl border border-line px-3 py-2"
                    >
                      <span className="tnum min-w-6 shrink-0 text-[11.5px] font-semibold text-ink-3">
                        {s.rollNo}
                      </span>
                      <Avatar name={s.name} hue={s.avatarHue} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">
                          {s.name}
                        </span>
                        <span className="block truncate text-[11px] text-ink-3">{s.registerNo}</span>
                      </span>
                      <input
                        aria-label={`${component} for ${s.name}`}
                        inputMode="numeric"
                        disabled={!can('result.enter')}
                        value={value}
                        placeholder="—"
                        onChange={(e) => setDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                        className="tnum h-9 w-16 shrink-0 rounded-lg border border-line bg-surface px-2 text-right text-[13px] text-ink outline-none focus:border-brand-500 disabled:opacity-60"
                      />
                      <span className="shrink-0 text-[12px] text-ink-3">/ {maxMarks}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader
            title="Pass rate by paper"
            subtitle={`Semester ${sectionById(db, sectionId)?.semester ?? ''} — where a department looks first`}
          />
          <CardBody className="pt-2">
            {passRates.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="size-6" />}
                title="No results yet for this semester"
              />
            ) : (
              <BarList data={passRates.slice(0, 8)} valueLabel="Pass rate" unit="%" height={260} />
            )}
          </CardBody>
        </MotionCard>
      </div>
    </>
  );
}

/* ── the examination cell's view ──────────────────────────────────────── */

function ExamCell() {
  const db = useDatabase();
  const can = useCan();
  const [sectionId, setSectionId] = useState(db.sections[0]?.id ?? '');
  const section = sectionById(db, sectionId);
  const roll = studentsInSection(db, sectionId);

  const rows = roll
    .map((student) => ({ student, standing: academicStanding(db, student.id) }))
    .sort((a, b) => b.standing.cgpa - a.standing.cgpa);

  const withArrears = rows.filter((r) => r.standing.arrears > 0).length;
  const unpublished = db.exams.filter((e) => !e.published);

  return (
    <>
      <PageHeader
        title="Results"
        subtitle="Grades, arrears and publication"
        action={
          can('result.publish') && unpublished.length > 0 ? (
            <Button
              icon={<Send className="size-4" />}
              onClick={() => {
                publishResults(unpublished[0]!.id);
                toast.success(`${unpublished[0]!.name} published`);
              }}
            >
              Publish {unpublished[0]!.shortName}
            </Button>
          ) : null
        }
      />

      <StatGrid>
        <StatTile
          label="Cohort CGPA"
          value={
            rows.length
              ? (rows.reduce((t, r) => t + r.standing.cgpa, 0) / rows.length).toFixed(2)
              : '—'
          }
          note={section?.label ?? ''}
          icon={Award}
        />
        <StatTile
          label="Carrying arrears"
          value={withArrears}
          note={`of ${rows.length} in this cohort`}
          icon={TriangleAlert}
          tone={withArrears ? 'warning' : 'good'}
          delay={0.06}
        />
        <StatTile
          label="Examinations"
          value={db.exams.length}
          note={`${unpublished.length} not yet published`}
          icon={GraduationCap}
          delay={0.12}
        />
        <StatTile
          label="Papers this semester"
          value={offeringsOf(db, sectionId).length}
          note="Including electives"
          icon={BookOpen}
          delay={0.18}
        />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader
          title="Cohort standing"
          subtitle="By CGPA, with arrears — the two figures a recruiter screens on"
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
            {rows.map((r, i) => (
              <li
                key={r.student.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-2.5"
              >
                <span className="tnum min-w-6 shrink-0 text-[11.5px] font-semibold text-ink-3">
                  {i + 1}
                </span>
                <Avatar name={r.student.name} hue={r.student.avatarHue} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">
                    {r.student.name}
                  </span>
                  <span className="block truncate text-[11.5px] text-ink-3">
                    {r.student.registerNo}
                  </span>
                </span>
                <span className="tnum shrink-0 text-[13px] font-semibold text-ink">
                  {r.standing.cgpa.toFixed(2)}
                </span>
                {r.standing.arrears > 0 ? (
                  <Badge tone="critical">{r.standing.arrears} arrear{r.standing.arrears === 1 ? '' : 's'}</Badge>
                ) : (
                  <Badge tone="good">clear</Badge>
                )}
              </li>
            ))}
          </ul>
        </CardBody>
      </MotionCard>

      <MotionCard delay={0.16} className="mt-5">
        <CardHeader title="Examinations" subtitle="Published results are visible to students at once" />
        <CardBody className="pt-4">
          <ul className="space-y-2">
            {db.exams.map((exam) => (
              <li
                key={exam.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">
                    {exam.name}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-3">
                    {formatDate(exam.startsOn)} – {formatDate(exam.endsOn)} · {exam.academicYear}
                  </span>
                </span>
                {exam.published ? (
                  <Badge tone="good" icon={<CheckCircle2 className="size-3" />}>
                    Published
                  </Badge>
                ) : (
                  <Badge tone="warning">Withheld</Badge>
                )}
                {!exam.published && can('result.publish') ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      publishResults(exam.id);
                      toast.success(`${exam.name} published`);
                    }}
                  >
                    Publish
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </CardBody>
      </MotionCard>
    </>
  );
}

export default function Results() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const can = useCan();

  if (user.roles.includes('parent') || user.roles.includes('student')) {
    if (!subject) {
      return (
        <EmptyState
          icon={<GraduationCap className="size-6" />}
          title="No student linked to this account"
          description="Please contact the college office."
        />
      );
    }
    return <StudentResults student={subject} />;
  }

  if (can('exam.manage')) return <ExamCell />;
  return <MarksEntry />;
}
