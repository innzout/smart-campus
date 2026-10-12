import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  HeartHandshake,
  MessageSquarePlus,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  attendanceByCourse,
  menteesOf,
  notesFor,
  sectionLabel,
  userById,
} from '@/lib/queries';
import { addMentorNote } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, EmptyState, PageHeader, Progress } from '@/components/ui/misc';
import { cn, formatDate, relativeTime } from '@/lib/utils';
import { ATTENDANCE_MINIMUM } from '@/data/types';
import type { User } from '@/data/types';

/**
 * Mentoring.
 *
 * Most Tamil Nadu colleges give every student a mentor who follows them across
 * all their papers and meets them monthly. It is the one piece of pastoral
 * structure a college has that a school does not, and it is the only screen
 * where a member of staff sees one student whole — attendance, arrears and what
 * was said last time — rather than one paper at a time.
 */

const CONCERN_TONE: Record<string, Tone> = {
  attendance: 'critical',
  academic: 'warning',
  personal: 'info',
  none: 'neutral',
};

const CONCERN_LABEL: Record<string, string> = {
  attendance: 'Attendance',
  academic: 'Academic',
  personal: 'Personal',
  none: 'Routine review',
};

/* ── a student or parent reading what the mentor wrote ────────────────── */

function StudentMentoring({ student }: { student: User }) {
  const db = useDatabase();
  const mentor = userById(db, student.mentorId);
  const notes = notesFor(db, student.id);

  return (
    <>
      <PageHeader
        title="Mentoring"
        subtitle={`${student.name} · ${sectionLabel(db, student.sectionId)} · mentor ${mentor?.name ?? 'not assigned'}`}
      />

      {mentor ? (
        <MotionCard delay={0.08} className="mb-5">
          <CardHeader title="Your mentor" subtitle="Who to go to first" />
          <CardBody className="pt-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3">
              <Avatar name={mentor.name} hue={mentor.avatarHue} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">
                  {mentor.name}
                </span>
                <span className="block truncate text-[12px] text-ink-3">
                  {mentor.qualification} · {mentor.phone}
                </span>
              </span>
              <a
                href={`mailto:${mentor.email}`}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-600 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-500"
              >
                Email
              </a>
            </div>
          </CardBody>
        </MotionCard>
      ) : null}

      <MotionCard delay={0.14}>
        <CardHeader title="Mentoring record" subtitle="Notes from each meeting, newest first" />
        <CardBody className="pt-4">
          {notes.length === 0 ? (
            <EmptyState
              icon={<HeartHandshake className="size-6" />}
              title="No notes yet"
              description="Notes appear here after each mentoring meeting."
            />
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl border border-line px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={CONCERN_TONE[n.concern]!}>{CONCERN_LABEL[n.concern]}</Badge>
                    <span className="text-[11.5px] text-ink-3">{formatDate(n.on)}</span>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{n.note}</p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </MotionCard>
    </>
  );
}

/* ── a mentor's own list ──────────────────────────────────────────────── */

function MentorList() {
  const db = useDatabase();
  const me = useCurrentUser();
  const can = useCan();
  const mentees = menteesOf(db, me.id);
  const [open, setOpen] = useState<string | null>(null);

  const atRisk = mentees.filter((m) => m.attendance.shortIn > 0);
  const withArrears = mentees.filter((m) => m.standing.arrears > 0);
  const unseen = mentees.filter((m) => !m.lastNote);

  if (mentees.length === 0) {
    return (
      <>
        <PageHeader title="Mentoring" subtitle={me.name} />
        <EmptyState
          icon={<HeartHandshake className="size-6" />}
          title="No mentees assigned"
          description="Students are allotted a mentor from their own department at admission."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Mentoring"
        subtitle={`${mentees.length} mentees · sorted by attendance, worst first`}
      />

      <StatGrid>
        <StatTile label="Mentees" value={mentees.length} note="Allotted to you" icon={Users} />
        <StatTile
          label="Short of attendance"
          value={atRisk.length}
          note={atRisk.length ? 'Below 75% in at least one paper' : 'All attending'}
          icon={AlertTriangle}
          tone={atRisk.length ? 'critical' : 'good'}
          delay={0.06}
        />
        <StatTile
          label="Carrying arrears"
          value={withArrears.length}
          note={withArrears.length ? 'Papers still to clear' : 'All clear'}
          icon={TrendingUp}
          tone={withArrears.length ? 'warning' : 'good'}
          delay={0.12}
        />
        <StatTile
          label="Never seen"
          value={unseen.length}
          note={unseen.length ? 'No mentoring note on record' : 'Everyone has been met'}
          icon={MessageSquarePlus}
          tone={unseen.length ? 'warning' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader
          title="Your mentees"
          subtitle="Attendance and arrears together — the two things worth acting on"
        />
        <CardBody className="pt-4">
          <ul className="space-y-2">
            {mentees.map((m) => (
              <li key={m.student.id}>
                <button
                  type="button"
                  onClick={() => setOpen(m.student.id)}
                  className={cn(
                    'flex w-full flex-wrap items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-hover',
                    m.attendance.shortIn
                      ? 'border-[--color-critical]/35 bg-[--color-critical]/[0.04]'
                      : 'border-line',
                  )}
                >
                  <Avatar name={m.student.name} hue={m.student.avatarHue} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">
                      {m.student.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                      {m.student.registerNo} · {m.section?.label}
                      {m.lastNote ? ` · last seen ${relativeTime(m.lastNote.on)}` : ' · never seen'}
                    </span>
                  </span>

                  <span className="w-24 shrink-0">
                    <Progress
                      value={m.attendance.percent}
                      tone={m.attendance.shortIn ? 'critical' : 'good'}
                      className="h-1.5"
                      label="Attendance"
                    />
                  </span>
                  <span className="tnum min-w-12 shrink-0 text-right text-[13px] font-semibold text-ink">
                    {m.attendance.percent}%
                  </span>
                  {m.standing.arrears ? (
                    <Badge tone="warning">{m.standing.arrears} arrears</Badge>
                  ) : (
                    <Badge tone="good">clear</Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </MotionCard>

      {open ? (
        <MenteeDialog
          studentId={open}
          mentorId={me.id}
          canNote={can('mentor.note')}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function MenteeDialog({
  studentId,
  mentorId,
  canNote,
  onClose,
}: {
  studentId: string;
  mentorId: string;
  canNote: boolean;
  onClose: () => void;
}) {
  const db = useDatabase();
  const student = userById(db, studentId);
  const byCourse = attendanceByCourse(db, studentId);
  const notes = notesFor(db, studentId);
  const [note, setNote] = useState('');
  const [concern, setConcern] = useState<'attendance' | 'academic' | 'personal' | 'none'>('none');

  if (!student) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={student.name}
      description={`${student.registerNo} · ${sectionLabel(db, student.sectionId)}`}
      size="lg"
      footer={
        canNote ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              disabled={note.trim().length < 10}
              onClick={() => {
                addMentorNote({ mentorId, studentId, note: note.trim(), concern });
                toast.success('Note recorded', {
                  description:
                    concern === 'none'
                      ? undefined
                      : 'The parent has been notified, since a concern was raised.',
                });
                setNote('');
                setConcern('none');
              }}
            >
              Record note
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
            Attendance, paper by paper
          </p>
          <ul className="space-y-1.5">
            {byCourse.map((row) => (
              <li
                key={row.offering.id}
                className="flex items-center gap-3 rounded-lg border border-line px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                  {row.course?.title}
                </span>
                <span className="w-20 shrink-0">
                  <Progress
                    value={row.percent}
                    tone={row.short ? 'critical' : 'good'}
                    className="h-1.5"
                    label="Attendance"
                  />
                </span>
                <span className="tnum min-w-12 shrink-0 text-right text-[12.5px] font-semibold text-ink">
                  {row.percent}%
                </span>
                {row.short ? (
                  <Badge tone="critical">below {ATTENDANCE_MINIMUM}%</Badge>
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 text-[--color-good]" aria-hidden />
                )}
              </li>
            ))}
          </ul>
        </div>

        {canNote ? (
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <Field label="Concern" htmlFor="mc">
              <Select
                id="mc"
                value={concern}
                onChange={(e) => setConcern(e.target.value as typeof concern)}
              >
                <option value="none">Routine review</option>
                <option value="attendance">Attendance</option>
                <option value="academic">Academic</option>
                <option value="personal">Personal</option>
              </Select>
            </Field>
            <Field
              label="Note"
              htmlFor="mn"
              hint="Anything other than a routine review notifies the parent."
            >
              <Textarea
                id="mn"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Discussed the shortage in Operating Systems. Parent informed by telephone."
              />
            </Field>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
            Record
          </p>
          {notes.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">No notes on record yet.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-surface-2 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={CONCERN_TONE[n.concern]!}>{CONCERN_LABEL[n.concern]}</Badge>
                    <span className="text-[11px] text-ink-3">{formatDate(n.on)}</span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{n.note}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function Mentoring() {
  const user = useCurrentUser();
  const { subject } = useAuth();

  if (user.roles.includes('parent') || user.roles.includes('student')) {
    if (!subject) {
      return (
        <EmptyState
          icon={<HeartHandshake className="size-6" />}
          title="No student linked to this account"
          description="Please contact the college office."
        />
      );
    }
    return <StudentMentoring student={subject} />;
  }

  return <MentorList />;
}
