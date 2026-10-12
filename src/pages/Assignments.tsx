import { useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  PenLine,
  Plus,
  Upload,
} from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  assignmentsForStudent,
  courseById,
  offeringsOf,
  sectionLabel,
  sectionsForFaculty,
  userById,
} from '@/lib/queries';
import { createAssignment, gradeAssignment, submitAssignment } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, EmptyState, PageHeader } from '@/components/ui/misc';
import { cn, formatDate, relativeDay, todayISO } from '@/lib/utils';
import type { User } from '@/data/types';

/**
 * Assignments.
 *
 * In a college an assignment is not a diary entry a parent ticks off — it
 * carries marks into the internal assessment, so what matters is whether it was
 * submitted and what it scored.
 */

const STATE: Record<string, { label: string; tone: Tone }> = {
  marked: { label: 'Marked', tone: 'good' },
  submitted: { label: 'Submitted', tone: 'info' },
  overdue: { label: 'Overdue', tone: 'critical' },
  'due-soon': { label: 'Due soon', tone: 'warning' },
  pending: { label: 'Pending', tone: 'neutral' },
};

/* ── a student's own list ─────────────────────────────────────────────── */

function StudentAssignments({ student, canSubmit }: { student: User; canSubmit: boolean }) {
  const db = useDatabase();
  const rows = assignmentsForStudent(db, student.id);
  const pending = rows.filter((r) => r.state === 'pending' || r.state === 'due-soon');
  const overdue = rows.filter((r) => r.state === 'overdue');
  const marked = rows.filter((r) => r.state === 'marked');
  const scored = marked.reduce((t, r) => t + (r.marks ?? 0), 0);
  const outOf = marked.reduce((t, r) => t + r.assignment.maxMarks, 0);

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle={`${student.name} · ${sectionLabel(db, student.sectionId)} · marks count towards the internal assessment`}
      />

      <StatGrid>
        <StatTile
          label="To submit"
          value={pending.length}
          note={pending[0] ? `Next: ${relativeDay(pending[0].assignment.dueOn)}` : 'Nothing outstanding'}
          icon={ClipboardList}
          tone={pending.length ? 'warning' : 'good'}
        />
        <StatTile
          label="Overdue"
          value={overdue.length}
          note={overdue.length ? 'Submit at the department office' : 'Nothing overdue'}
          icon={Clock}
          tone={overdue.length ? 'critical' : 'good'}
          delay={0.06}
        />
        <StatTile
          label="Marked"
          value={marked.length}
          note={outOf ? `${scored} of ${outOf} marks` : 'Nothing marked yet'}
          icon={CheckCircle2}
          delay={0.12}
        />
        <StatTile
          label="Papers"
          value={new Set(rows.map((r) => r.course?.id)).size}
          note="With assignments this semester"
          icon={FileText}
          delay={0.18}
        />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader title="Your assignments" subtitle="Soonest first" />
        <CardBody className="pt-4">
          {rows.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title="No assignments set"
              description="Assignments appear here as your faculty set them."
            />
          ) : (
            <ul className="space-y-2.5">
              {rows.map((row) => {
                const state = STATE[row.state]!;
                return (
                  <li
                    key={row.assignment.id}
                    className={cn(
                      'rounded-xl border p-4',
                      row.state === 'overdue'
                        ? 'border-[--color-critical]/35 bg-[--color-critical]/[0.04]'
                        : 'border-line',
                    )}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-semibold text-ink">
                            {row.assignment.title}
                          </span>
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-ink-3">
                          {row.course?.title} · due {formatDate(row.assignment.dueOn)} (
                          {relativeDay(row.assignment.dueOn)}) · out of {row.assignment.maxMarks}
                        </span>
                      </span>
                      {row.marks != null ? (
                        <span className="tnum shrink-0 text-[15px] font-semibold text-ink">
                          {row.marks}/{row.assignment.maxMarks}
                        </span>
                      ) : canSubmit && !row.submittedOn ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Upload className="size-3.5" />}
                          onClick={() => {
                            submitAssignment(row.assignment.id, student.id);
                            toast.success('Marked as submitted', {
                              description: 'Hand the written copy to your faculty as well.',
                            });
                          }}
                        >
                          Mark submitted
                        </Button>
                      ) : null}
                    </div>

                    <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
                      {row.assignment.description}
                    </p>

                    {row.remark ? (
                      <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-ink-2">
                        <span className="font-semibold text-ink">Remark:</span> {row.remark}
                      </p>
                    ) : null}
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

/* ── what a member of faculty sets and marks ──────────────────────────── */

function FacultyAssignments() {
  const db = useDatabase();
  const me = useCurrentUser();
  const can = useCan();
  const mySections = sectionsForFaculty(db, me.id);

  const [sectionId, setSectionId] = useState(mySections[0]?.id ?? db.sections[0]?.id ?? '');
  const offerings = offeringsOf(db, sectionId);
  const [setting, setSetting] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);

  const mine = db.assignments.filter((a) =>
    offerings.some((o) => o.id === a.offeringId),
  );

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle={`${sectionLabel(db, sectionId)} · ${mine.length} set this semester`}
        action={
          <>
            <Select
              aria-label="Cohort"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="h-9 min-w-[12rem] text-[13px]"
            >
              {(mySections.length ? mySections : db.sections).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            {can('assignment.create') ? (
              <Button icon={<Plus className="size-4" />} onClick={() => setSetting(true)}>
                Set an assignment
              </Button>
            ) : null}
          </>
        }
      />

      <MotionCard delay={0.1}>
        <CardHeader title="Set so far" subtitle="Open one to mark it" />
        <CardBody className="pt-4">
          {mine.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title="Nothing set for this cohort"
              description="Set an assignment and every enrolled student is notified."
            />
          ) : (
            <ul className="space-y-2">
              {mine.map((a) => {
                const course = courseById(
                  db,
                  offerings.find((o) => o.id === a.offeringId)?.courseId,
                );
                const statuses = db.assignmentStatus.filter((s) => s.assignmentId === a.id);
                const submitted = statuses.filter((s) => s.submittedOn).length;
                const graded = statuses.filter((s) => s.marks != null).length;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setMarking(a.id)}
                      className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {a.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                          {course?.title} · due {formatDate(a.dueOn)} · out of {a.maxMarks}
                        </span>
                      </span>
                      <Badge tone={submitted === statuses.length ? 'good' : 'warning'}>
                        {submitted}/{statuses.length} submitted
                      </Badge>
                      <Badge tone={graded === statuses.length ? 'good' : 'neutral'}>
                        {graded} marked
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </MotionCard>

      {setting ? (
        <SetAssignmentDialog
          sectionId={sectionId}
          facultyId={me.id}
          onClose={() => setSetting(false)}
        />
      ) : null}
      {marking ? <MarkDialog assignmentId={marking} onClose={() => setMarking(null)} /> : null}
    </>
  );
}

function SetAssignmentDialog({
  sectionId,
  facultyId,
  onClose,
}: {
  sectionId: string;
  facultyId: string;
  onClose: () => void;
}) {
  const db = useDatabase();
  const offerings = offeringsOf(db, sectionId);
  const [offeringId, setOfferingId] = useState(offerings[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxMarks, setMaxMarks] = useState(10);
  const [dueOn, setDueOn] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  const valid = title.trim().length > 4 && description.trim().length > 10 && offeringId;

  return (
    <Modal
      open
      onClose={onClose}
      title="Set an assignment"
      description="Every student enrolled in the paper is notified at once."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              createAssignment({
                offeringId,
                title: title.trim(),
                description: description.trim(),
                dueOn,
                maxMarks,
                assignedById: facultyId,
              });
              toast.success('Assignment set', {
                description: 'Students have been notified and it appears in their list.',
              });
              onClose();
            }}
          >
            Set assignment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Paper" required htmlFor="ao">
          <Select id="ao" value={offeringId} onChange={(e) => setOfferingId(e.target.value)}>
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {courseById(db, o.courseId)?.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" required htmlFor="at">
          <Input
            id="at"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Unit II — Normalisation problems"
          />
        </Field>
        <Field label="What is required" required htmlFor="ad">
          <Textarea
            id="ad"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Answer all questions from unit II. Hand-written submissions only, with the register number on every sheet."
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due on" required htmlFor="adue">
            <Input
              id="adue"
              type="date"
              min={todayISO()}
              value={dueOn}
              onChange={(e) => setDueOn(e.target.value)}
            />
          </Field>
          <Field label="Out of" htmlFor="am" hint="Counts towards the internal assessment.">
            <Input
              id="am"
              type="number"
              min={1}
              max={50}
              value={maxMarks}
              onChange={(e) => setMaxMarks(Number(e.target.value))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function MarkDialog({ assignmentId, onClose }: { assignmentId: string; onClose: () => void }) {
  const db = useDatabase();
  const can = useCan();
  const assignment = db.assignments.find((a) => a.id === assignmentId);
  const course = courseById(db, db.offerings.find((o) => o.id === assignment?.offeringId)?.courseId);
  const rows = db.assignmentStatus
    .filter((s) => s.assignmentId === assignmentId)
    .map((status) => ({ status, student: userById(db, status.studentId) }))
    .filter((r) => r.student)
    .sort((a, b) => (a.student!.rollNo ?? 0) - (b.student!.rollNo ?? 0));

  const [draft, setDraft] = useState<Record<string, string>>({});

  if (!assignment) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={assignment.title}
      description={`${course?.title} · out of ${assignment.maxMarks} · due ${formatDate(assignment.dueOn)}`}
      size="lg"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <ul className="space-y-1.5">
        {rows.map(({ status, student }) => {
          const value = draft[status.id] ?? status.marks?.toString() ?? '';
          return (
            <li
              key={status.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2"
            >
              <span className="tnum min-w-6 shrink-0 text-[11.5px] font-semibold text-ink-3">
                {student!.rollNo}
              </span>
              <Avatar name={student!.name} hue={student!.avatarHue} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {student!.name}
                </span>
                <span className="block truncate text-[11px] text-ink-3">
                  {status.submittedOn ? `Submitted ${formatDate(status.submittedOn)}` : 'Not submitted'}
                </span>
              </span>
              {status.submittedOn ? null : <Badge tone="critical">Not in</Badge>}
              <input
                aria-label={`Marks for ${student!.name}`}
                inputMode="numeric"
                disabled={!can('assignment.grade')}
                value={value}
                placeholder="—"
                onChange={(e) => setDraft((d) => ({ ...d, [status.id]: e.target.value }))}
                onBlur={() => {
                  const raw = draft[status.id];
                  if (raw == null || raw === '') return;
                  const marks = Math.max(0, Math.min(assignment.maxMarks, Number(raw)));
                  if (Number.isNaN(marks)) return;
                  gradeAssignment({
                    assignmentId,
                    studentId: status.studentId,
                    marks,
                    remark: status.remark,
                  });
                }}
                className="tnum h-9 w-16 shrink-0 rounded-lg border border-line bg-surface px-2 text-right text-[13px] text-ink outline-none focus:border-brand-500 disabled:opacity-60"
              />
              <span className="shrink-0 text-[12px] text-ink-3">/ {assignment.maxMarks}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-2 text-[11.5px] text-ink-3">
        <PenLine className="size-3.5" aria-hidden />
        Marks save as you leave each box.
      </p>
    </Modal>
  );
}

export default function Assignments() {
  const user = useCurrentUser();
  const { subject } = useAuth();

  if (user.roles.includes('parent') || user.roles.includes('student')) {
    if (!subject) {
      return (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title="No student linked to this account"
          description="Please contact the college office."
        />
      );
    }
    // A parent follows the work; only the student marks it submitted.
    return <StudentAssignments student={subject} canSubmit={user.roles.includes('student')} />;
  }

  return <FacultyAssignments />;
}
