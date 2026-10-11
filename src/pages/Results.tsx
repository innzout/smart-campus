import { useState } from 'react';
import { toast } from 'sonner';
import { Award, Download, GraduationCap, Medal, Send, TrendingUp } from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  classById,
  classLabel,
  classRank,
  classSubjectAverages,
  classesForTeacher,
  examsForGrade,
  gradeDistribution,
  publishedExamsFor,
  reportCard,
  reportTotals,
  studentsInClass,
  subjectsForClass,
  theSchool,
} from '@/lib/queries';
import { publishExam, saveMarks } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/Table';
import { Avatar, EmptyState, PageHeader, Progress, Segmented } from '@/components/ui/misc';
import { ColumnChart } from '@/components/charts/Charts';
import { RingGauge } from '@/components/charts/RingChart';
import { formatDate, pct } from '@/lib/utils';
import type { User } from '@/data/types';

const GRADE_TONE = (grade: string): Tone =>
  grade === 'A1' || grade === 'A2' ? 'good'
  : grade === 'B1' || grade === 'B2' ? 'info'
  : grade === 'E' ? 'critical'
  : 'warning';

/* ── parent / student: the report card ────────────────────────────────── */

function ChildReport({ student }: { student: User }) {
  const db = useDatabase();
  const school = theSchool(db);
  const exams = publishedExamsFor(db, student);
  const [examId, setExamId] = useState(exams.at(-1)?.id ?? '');
  const exam = exams.find((e) => e.id === examId) ?? exams.at(-1);

  if (!exam) {
    return (
      <>
        <PageHeader title="Report Card" subtitle={`${student.name} · ${classLabel(db, student.classId)}`} />
        <MotionCard>
          <EmptyState
            icon={<GraduationCap className="size-6" />}
            title="No results published yet"
            description="Report cards appear here as soon as the school publishes them."
          />
        </MotionCard>
      </>
    );
  }

  const lines = reportCard(db, student.id, exam.id);
  const totals = reportTotals(lines);
  const rank = classRank(db, student, exam.id);
  const best = [...lines].sort((a, b) => b.percent - a.percent)[0];
  const weakest = [...lines].sort((a, b) => a.percent - b.percent)[0];

  // How the child has moved across published exams.
  const progress = exams.map((e) => ({
    name: e.shortName,
    value: Number(reportTotals(reportCard(db, student.id, e.id)).percent.toFixed(1)),
    meta: e.name,
  }));

  const columns: Column<(typeof lines)[number] & { id: string }>[] = [
    {
      key: 'subject',
      header: 'Subject',
      sortBy: (r) => r.subject?.name ?? '',
      cell: (r) => (
        <div>
          <p className="font-semibold text-ink">{r.subject?.name}</p>
          {r.subject?.nameTa ? <p className="mt-0.5 text-[11.5px] text-ink-3">{r.subject.nameTa}</p> : null}
        </div>
      ),
    },
    {
      key: 'marks',
      header: 'Marks',
      align: 'right',
      sortBy: (r) => r.marks ?? 0,
      cell: (r) => (
        <span className="tnum font-semibold text-ink">
          {r.marks ?? '—'}<span className="font-normal text-ink-3"> / {r.maxMarks}</span>
        </span>
      ),
    },
    {
      key: 'bar',
      header: 'Performance',
      align: 'right',
      hideOnMobile: true,
      sortBy: (r) => r.percent,
      width: '10rem',
      cell: (r) => (
        <div className="ml-auto max-w-[8rem]">
          <Progress
            value={r.percent}
            tone={r.percent >= 75 ? 'good' : r.percent >= 50 ? 'brand' : r.percent >= 35 ? 'warning' : 'critical'}
            className="h-1.5"
            label={`${r.subject?.name} score`}
          />
        </div>
      ),
    },
    {
      key: 'grade',
      header: 'Grade',
      align: 'right',
      sortBy: (r) => r.percent,
      cell: (r) => (
        <div className="flex flex-col items-end gap-1">
          <Badge tone={GRADE_TONE(r.grade)}>{r.grade}</Badge>
          <span className="text-[11px] text-ink-3">{r.remark}</span>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Report Card"
        subtitle={`${student.name} · ${classLabel(db, student.classId)} · roll ${student.rollNo}`}
        action={
          <>
            {exams.length > 1 ? (
              <Segmented
                size="sm"
                value={exam.id}
                onChange={setExamId}
                options={exams.map((e) => ({ value: e.id, label: e.shortName }))}
              />
            ) : null}
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => toast.info('Report card download is simulated in this demo.')}>
              Download
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatTile label="Total marks" value={`${totals.obtained}/${totals.max}`} note={exam.name} icon={GraduationCap} />
        <StatTile label="Percentage" value={pct(totals.percent, 1)} note={`Grade ${totals.grade} — ${totals.remark}`} icon={TrendingUp} tone={totals.percent >= 60 ? 'good' : totals.percent >= 35 ? 'warning' : 'critical'} delay={0.06} />
        <StatTile label="Class rank" value={rank.rank ? `${rank.rank}` : '—'} note={`Out of ${rank.outOf} students in ${classLabel(db, student.classId)}`} icon={Medal} tone={rank.rank && rank.rank <= 5 ? 'good' : 'neutral'} delay={0.12} />
        <StatTile label="Best subject" value={best?.grade ?? '—'} note={best?.subject?.name ?? '—'} icon={Award} tone="good" delay={0.18} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <MotionCard delay={0.1}>
          <CardHeader title={exam.shortName} subtitle={`Held ${formatDate(exam.startsOn)}`} />
          <CardBody className="flex flex-col items-center pt-2">
            <RingGauge
              value={totals.percent}
              label={totals.grade}
              sublabel={`${totals.obtained}/${totals.max}`}
              tone={totals.percent >= 75 ? 'good' : totals.percent >= 50 ? 'brand' : totals.percent >= 35 ? 'warning' : 'critical'}
              size={176}
            />
            <p className="mt-5 w-full rounded-xl bg-surface-2 px-4 py-3 text-center text-[12.5px] leading-relaxed text-ink-2">
              {totals.failed > 0
                ? `${totals.failed} subject${totals.failed > 1 ? 's' : ''} below the pass mark — ${weakest?.subject?.name} needs the most attention.`
                : `All subjects passed. ${weakest?.subject?.name} has the most room to improve.`}
            </p>
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader title="Subject-wise marks" subtitle={`Out of ${lines[0]?.maxMarks ?? 100} each`} />
          <CardBody className="pt-4">
            <DataTable
              columns={columns}
              rows={lines.map((l) => ({ ...l, id: l.subject?.id ?? l.grade }))}
              initialSort={{ key: 'marks', dir: 'desc' }}
            />
          </CardBody>
        </MotionCard>
      </div>

      {progress.length > 1 ? (
        <MotionCard delay={0.2} className="mt-5">
          <CardHeader title="Progress across exams" subtitle="Overall percentage each time" />
          <CardBody className="pt-2">
            <ColumnChart data={progress} unit="%" valueLabel="Percentage" maxValue={100} />
          </CardBody>
        </MotionCard>
      ) : null}

      <p className="mt-5 text-center text-[11.5px] text-ink-3">
        {school.name} · {school.academicYear} · grades follow the Tamil Nadu matriculation scale
      </p>
    </>
  );
}

/* ── teacher: enter and publish marks ─────────────────────────────────── */

function ClassMarks() {
  const user = useCurrentUser();
  const db = useDatabase();
  const can = useCan();

  const myClasses = classesForTeacher(db, user.id);
  const [classId, setClassId] = useState(
    db.classes.find((c) => c.classTeacherId === user.id)?.id ??
      myClasses[0]?.id ??
      db.classes[0]?.id ??
      '',
  );
  const cls = classById(db, classId)!;
  const exams = examsForGrade(db, cls.grade);
  const [examId, setExamId] = useState(exams.find((e) => e.published)?.id ?? exams[0]?.id ?? '');
  const exam = exams.find((e) => e.id === examId);

  const subjects = subjectsForClass(db, classId);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const roster = studentsInClass(db, classId);

  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const current = (studentId: string) => {
    if (draft && studentId in draft) return draft[studentId]!;
    const row = db.marks.find((m) => m.studentId === studentId && m.examId === examId && m.subjectId === subjectId);
    return row?.marks == null ? '' : String(row.marks);
  };

  const save = () => {
    if (!draft) {
      toast.info('No changes to save.');
      return;
    }
    const parsed: Record<string, number | null> = {};
    for (const [studentId, value] of Object.entries(draft)) {
      const n = value.trim() === '' ? null : Number(value);
      if (n != null && (Number.isNaN(n) || n < 0 || n > 100)) {
        toast.error('Marks must be between 0 and 100.');
        return;
      }
      parsed[studentId] = n;
    }
    saveMarks({ examId, subjectId, marks: parsed });
    setDraft(null);
    toast.success('Marks saved', { description: `${subjects.find((s) => s.id === subjectId)?.name} · ${cls.label}` });
  };

  const averages = exam ? classSubjectAverages(db, classId, exam.id) : [];
  const distribution = exam ? gradeDistribution(db, classId, exam.id) : [];

  const rows = roster.map((s) => {
    const totals = exam ? reportTotals(reportCard(db, s.id, exam.id)) : null;
    return { id: s.id, student: s, name: s.name, roll: s.rollNo ?? 0, totals };
  });

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'roll', header: 'Roll', align: 'right', sortBy: (r) => r.roll, cell: (r) => <span className="tnum">{r.roll}</span> },
    {
      key: 'name',
      header: 'Student',
      sortBy: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.student.name} hue={r.student.avatarHue} size="sm" />
          <span className="truncate font-semibold text-ink">{r.name}</span>
        </div>
      ),
    },
    { key: 'total', header: 'Total', align: 'right', sortBy: (r) => r.totals?.obtained ?? 0, cell: (r) => <span className="tnum">{r.totals ? `${r.totals.obtained}/${r.totals.max}` : '—'}</span> },
    { key: 'percent', header: 'Percentage', align: 'right', hideOnMobile: true, sortBy: (r) => r.totals?.percent ?? 0, cell: (r) => <span className="tnum font-semibold text-ink">{r.totals ? pct(r.totals.percent, 1) : '—'}</span> },
    { key: 'grade', header: 'Grade', align: 'right', sortBy: (r) => r.totals?.percent ?? 0, cell: (r) => (r.totals ? <Badge tone={GRADE_TONE(r.totals.grade)}>{r.totals.grade}</Badge> : '—') },
  ];

  return (
    <>
      <PageHeader
        title="Marks & Report Cards"
        subtitle="Enter subject marks, then publish the report card to parents."
        action={
          <div className="flex flex-wrap gap-2">
            <Segmented size="sm" value={classId} onChange={(v) => { setClassId(v); setDraft(null); }} options={myClasses.map((c) => ({ value: c.id, label: c.label }))} />
            {exams.length ? (
              <Segmented size="sm" value={examId} onChange={(v) => { setExamId(v); setDraft(null); }} options={exams.map((e) => ({ value: e.id, label: e.shortName }))} />
            ) : null}
          </div>
        }
      />

      {exam ? (
        <StatGrid>
          <StatTile label="Students" value={roster.length} note={`Class ${cls.label}`} icon={GraduationCap} />
          <StatTile label="Class average" value={averages.length ? pct(averages.reduce((t, a) => t + a.value, 0) / averages.length, 1) : '—'} note={exam.name} icon={TrendingUp} delay={0.06} />
          <StatTile label="Below pass mark" value={rows.filter((r) => (r.totals?.failed ?? 0) > 0).length} note="In at least one subject" icon={Award} tone={rows.some((r) => (r.totals?.failed ?? 0) > 0) ? 'warning' : 'good'} delay={0.12} />
          <StatTile label="Report card" value={exam.published ? 'Published' : 'Draft'} note={exam.published ? 'Visible to parents' : 'Not yet visible to parents'} icon={Send} tone={exam.published ? 'good' : 'neutral'} delay={0.18} />
        </StatGrid>
      ) : null}

      {exam && can('result.enter') ? (
        <MotionCard delay={0.1}>
          <CardHeader
            title="Enter marks"
            subtitle={`${exam.name} · out of 100`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Segmented size="sm" value={subjectId} onChange={(v) => { setSubjectId(v); setDraft(null); }} options={subjects.map((s) => ({ value: s.id, label: s.code.replace(/\d+$/, '') }))} />
                <Button size="sm" onClick={save}>Save marks</Button>
                {can('result.publish') && !exam.published ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Send className="size-3.5" />}
                    onClick={() => {
                      publishExam(exam.id);
                      toast.success('Report card published', { description: 'Parents have been notified.' });
                    }}
                  >
                    Publish
                  </Button>
                ) : null}
              </div>
            }
          />
          <CardBody className="pt-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {roster.map((s) => (
                <label key={s.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                  <span className="tnum min-w-6 shrink-0 text-[11.5px] font-semibold text-ink-3">{s.rollNo}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{s.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={current(s.id)}
                    onChange={(e) => setDraft({ ...(draft ?? {}), [s.id]: e.target.value })}
                    aria-label={`Marks for ${s.name}`}
                    className="tnum h-9 w-16 shrink-0 rounded-lg border border-line bg-surface px-2 text-right text-[13px] text-ink outline-none focus:border-brand-500"
                  />
                </label>
              ))}
            </div>
          </CardBody>
        </MotionCard>
      ) : null}

      {exam?.published ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <MotionCard delay={0.16}>
            <CardHeader title="Subject averages" subtitle="Where the class is strong and weak" />
            <CardBody className="pt-2">
              <ColumnChart data={averages} unit="%" valueLabel="Average" maxValue={100} />
            </CardBody>
          </MotionCard>
          <MotionCard delay={0.2}>
            <CardHeader title="Grade distribution" subtitle={`${cls.label} · ${exam.shortName}`} />
            <CardBody className="pt-2">
              <ColumnChart data={distribution} valueLabel="Students" />
            </CardBody>
          </MotionCard>
        </div>
      ) : null}

      <MotionCard delay={0.24} className="mt-5">
        <CardHeader title="Class results" subtitle={exam ? exam.name : 'Select an exam'} />
        <CardBody className="pt-4">
          {exam ? (
            <DataTable columns={columns} rows={rows} initialSort={{ key: 'percent', dir: 'desc' }} />
          ) : (
            <EmptyState icon={<GraduationCap className="size-6" />} title="No exams for this class yet" />
          )}
        </CardBody>
      </MotionCard>
    </>
  );
}

export default function Results() {
  const user = useCurrentUser();
  const { subject } = useAuth();

  if (user.roles.includes('parent') || user.roles.includes('student')) {
    if (!subject) return <EmptyState icon={<GraduationCap className="size-6" />} title="No student linked to this account" />;
    return <ChildReport student={subject} />;
  }
  return <ClassMarks />;
}
