import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { BookOpen, CheckCircle2, ClipboardList, Clock, Plus, XCircle } from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  classLabel,
  classesForTeacher,
  homeworkForClass,
  homeworkForStudent,
  homeworkStats,
  studentsInClass,
  subjectById,
  subjectsForClass,
} from '@/lib/queries';
import { createHomework, remarkHomework, setHomeworkDone } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, StatusPill } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, EmptyState, PageHeader, Progress, Segmented } from '@/components/ui/misc';
import { cn, formatDate, relativeDay, todayISO } from '@/lib/utils';
import type { User } from '@/data/types';

/* ── parent / student ──────────────────────────────────────────────────── */

function ChildHomework({ student, canTick }: { student: User; canTick: boolean }) {
  const db = useDatabase();
  const items = homeworkForStudent(db, student);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  const list = items.filter((h) =>
    filter === 'all' ? true : filter === 'done' ? h.done : !h.done,
  );
  const pending = items.filter((h) => !h.done);
  const overdue = pending.filter((h) => h.daysLeft < 0);

  return (
    <>
      <PageHeader
        title="Homework"
        subtitle={`${student.name} · ${classLabel(db, student.classId)} — the school diary, as the teacher wrote it.`}
        action={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All (${items.length})` },
              { value: 'pending', label: `Pending (${pending.length})` },
              { value: 'done', label: 'Done' },
            ]}
          />
        }
      />

      <StatGrid>
        <StatTile label="Pending" value={pending.length} note={overdue.length ? `${overdue.length} overdue` : 'Nothing overdue'} icon={ClipboardList} tone={overdue.length ? 'critical' : pending.length ? 'warning' : 'good'} />
        <StatTile label="Due today or tomorrow" value={pending.filter((h) => h.daysLeft >= 0 && h.daysLeft <= 1).length} note="Needs doing tonight" icon={Clock} tone="warning" delay={0.06} />
        <StatTile label="Completed" value={items.filter((h) => h.done).length} note="Marked done" icon={CheckCircle2} tone="good" delay={0.12} />
        <StatTile label="Subjects" value={new Set(items.map((h) => h.subject?.id)).size} note="With homework set" icon={BookOpen} delay={0.18} />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader title="Homework diary" subtitle={`${list.length} shown`} />
        <CardBody className="pt-4">
          {list.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="size-6" />} title="Nothing here" description="No homework in this view." />
          ) : (
            <ul className="space-y-3">
              {list.map((h) => (
                <li
                  key={h.homework.id}
                  className={cn(
                    'rounded-xl border p-4',
                    h.state === 'overdue' ? 'border-[--color-critical]/35 bg-[--color-critical]/[0.04]'
                    : h.state === 'due-soon' ? 'border-[--color-warning]/40 bg-[--color-warning]/[0.05]'
                    : 'border-line bg-surface',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14.5px] font-semibold text-ink">{h.homework.title}</h3>
                        <StatusPill status={h.state === 'done' ? 'submitted' : h.state} />
                      </div>
                      <p className="mt-1 text-[12.5px] text-ink-3">
                        {h.subject?.name}
                        {h.subject?.nameTa ? ` · ${h.subject.nameTa}` : ''} — due {formatDate(h.homework.dueOn)} ({relativeDay(h.homework.dueOn)})
                      </p>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{h.homework.description}</p>
                      {h.remark ? (
                        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
                          <span className="font-medium text-ink">Teacher’s remark:</span> {h.remark}
                        </p>
                      ) : null}
                    </div>

                    {canTick ? (
                      <Button
                        size="sm"
                        variant={h.done ? 'secondary' : 'primary'}
                        onClick={() => {
                          setHomeworkDone(h.homework.id, student.id, !h.done);
                          toast.success(h.done ? 'Marked as not done' : 'Marked as done');
                        }}
                      >
                        {h.done ? 'Undo' : 'Mark done'}
                      </Button>
                    ) : (
                      <Badge tone={h.done ? 'good' : 'neutral'}>{h.done ? 'Done' : 'Not done'}</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </MotionCard>
    </>
  );
}

/* ── teacher ───────────────────────────────────────────────────────────── */

const schema = z.object({
  classId: z.string().min(1, 'Choose a class.'),
  subjectId: z.string().min(1, 'Choose a subject.'),
  title: z.string().trim().min(5, 'Give the homework a title.'),
  description: z.string().trim().min(15, 'Say what the children must do.'),
  dueOn: z.string().min(1, 'Pick a due date.').refine((v) => v >= todayISO(), 'The due date cannot be in the past.'),
});

function TeacherHomework() {
  const user = useCurrentUser();
  const db = useDatabase();
  const can = useCan();

  const myClasses = classesForTeacher(db, user.id);
  const [classId, setClassId] = useState(myClasses[0]?.id ?? db.classes[0]?.id ?? '');
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const list = homeworkForClass(db, classId);
  const subjects = subjectsForClass(db, classId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { classId, subjectId: subjects[0]?.id ?? '', title: '', description: '', dueOn: todayISO() },
  });

  const reviewRows = reviewing
    ? studentsInClass(db, classId).map((s) => ({
        student: s,
        status: db.homeworkStatus.find((x) => x.homeworkId === reviewing && x.studentId === s.id),
      }))
    : [];

  return (
    <>
      <PageHeader
        title="Homework"
        subtitle="Set the diary for your class. Parents are notified immediately."
        action={
          <div className="flex flex-wrap gap-2">
            <Segmented size="sm" value={classId} onChange={setClassId} options={myClasses.map((c) => ({ value: c.id, label: c.label }))} />
            {can('homework.create') ? (
              <Button onClick={() => setOpen(true)} icon={<Plus className="size-4" />}>Set homework</Button>
            ) : null}
          </div>
        }
      />

      <StatGrid>
        <StatTile label="Homework set" value={list.length} note={`Class ${classLabel(db, classId)}`} icon={ClipboardList} />
        <StatTile label="Due this week" value={list.filter((h) => h.dueOn >= todayISO()).length} note="Still open" icon={Clock} delay={0.06} />
        <StatTile label="Average completion" value={list.length ? `${Math.round(list.reduce((t, h) => { const s = homeworkStats(db, h.id); return t + (s.total ? (s.done / s.total) * 100 : 0); }, 0) / list.length)}%` : '—'} note="Across all homework" icon={CheckCircle2} tone="good" delay={0.12} />
        <StatTile label="Students" value={studentsInClass(db, classId).length} note="On roll" icon={BookOpen} delay={0.18} />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader title="Homework set" subtitle="Newest first — tap to see who has done it" />
        <CardBody className="pt-4">
          {list.length === 0 ? (
            <EmptyState icon={<ClipboardList className="size-6" />} title="No homework set yet" />
          ) : (
            <ul className="space-y-3">
              {list.map((h) => {
                const stats = homeworkStats(db, h.id);
                const percent = stats.total ? (stats.done / stats.total) * 100 : 0;
                return (
                  <li key={h.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[14px] font-semibold text-ink">{h.title}</h3>
                        <p className="mt-0.5 text-[12px] text-ink-3">
                          {subjectById(db, h.subjectId)?.name} · due {formatDate(h.dueOn)} ({relativeDay(h.dueOn)})
                        </p>
                        <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-ink-2">{h.description}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setReviewing(h.id)}>
                        {stats.done}/{stats.total} done
                      </Button>
                    </div>
                    <div className="mt-3">
                      <Progress value={percent} tone={percent > 75 ? 'good' : percent > 40 ? 'warning' : 'critical'} className="h-1.5" label={`${h.title} completion`} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </MotionCard>

      {/* who has done it */}
      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title="Who has done it"
        description={reviewing ? db.homework.find((h) => h.id === reviewing)?.title : ''}
        size="lg"
        footer={<Button onClick={() => setReviewing(null)}>Close</Button>}
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {reviewRows.map(({ student, status }) => (
            <li key={student.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
              <span className="tnum min-w-6 shrink-0 text-[11.5px] font-semibold text-ink-3">{student.rollNo}</span>
              <Avatar name={student.name} hue={student.avatarHue} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{student.name}</span>
              {status?.done ? (
                <Badge tone="good" icon={<CheckCircle2 className="size-3" />}>Done</Badge>
              ) : (
                <Badge tone="critical" icon={<XCircle className="size-3" />}>Not done</Badge>
              )}
              {reviewing && status?.done ? (
                <button
                  onClick={() => {
                    remarkHomework(reviewing, student.id, 'Good');
                    toast.success('Remark added');
                  }}
                  className="shrink-0 text-[11.5px] font-medium text-brand-600 hover:underline dark:text-brand-300"
                >
                  Remark
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </Modal>

      {/* set homework */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Set homework"
        description="Every parent in the class is notified as soon as you publish."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="hw-form" type="submit" loading={isSubmitting}>Publish</Button>
          </>
        }
      >
        <form
          id="hw-form"
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit(async (values) => {
            await new Promise((r) => setTimeout(r, 300));
            createHomework({ ...values, assignedById: user.id });
            toast.success('Homework set', { description: 'Parents have been notified.' });
            reset();
            setOpen(false);
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Class" error={errors.classId?.message} required htmlFor="h-class">
              <Select id="h-class" invalid={!!errors.classId} {...register('classId')}>
                {myClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Subject" error={errors.subjectId?.message} required htmlFor="h-subject">
              <Select id="h-subject" invalid={!!errors.subjectId} {...register('subjectId')}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Title" error={errors.title?.message} required htmlFor="h-title">
            <Input id="h-title" placeholder="Exercise 4.2 — Linear Equations" invalid={!!errors.title} {...register('title')} />
          </Field>

          <Field label="Due date" error={errors.dueOn?.message} required htmlFor="h-due">
            <Input id="h-due" type="date" min={todayISO()} invalid={!!errors.dueOn} {...register('dueOn')} />
          </Field>

          <Field label="What should they do?" error={errors.description?.message} required htmlFor="h-desc">
            <Textarea id="h-desc" rows={4} invalid={!!errors.description} {...register('description')} />
          </Field>
        </form>
      </Modal>
    </>
  );
}

export default function Homework() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const can = useCan();

  if (user.roles.includes('parent') || user.roles.includes('student')) {
    if (!subject) return <EmptyState icon={<ClipboardList className="size-6" />} title="No student linked to this account" />;
    return <ChildHomework student={subject} canTick={can('homework.update')} />;
  }
  return <TeacherHomework />;
}
