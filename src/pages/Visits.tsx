import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle2, Clock, DoorOpen, LogIn, LogOut, Plus, QrCode, ShieldCheck } from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { mutate, newId, useDatabase } from '@/lib/store';
import { sectionLabel, userById } from '@/lib/queries';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/Table';
import { Avatar, EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { formatDate, formatTime, relativeDay, todayISO } from '@/lib/utils';
import type { User, Visit } from '@/data/types';

const PURPOSES = [
  'Parent-Teacher Meeting',
  'Meet a faculty member',
  'Fee payment',
  'Hostel',
  'Document collection',
  'Other',
] as const;

const STATUS_TONE: Record<Visit['status'], Tone> = {
  requested: 'warning',
  approved: 'info',
  'checked-in': 'brand',
  completed: 'good',
  rejected: 'critical',
};

const STATUS_LABEL: Record<Visit['status'], string> = {
  requested: 'Awaiting approval',
  approved: 'Approved',
  'checked-in': 'Inside school',
  completed: 'Completed',
  rejected: 'Not approved',
};

const schema = z.object({
  purpose: z.enum(PURPOSES),
  date: z.string().min(1, 'Choose a date.').refine((v) => v >= todayISO(), 'Pick today or a later date.'),
  time: z.string().min(1, 'Choose a time.'),
  meetingWith: z.string().trim().min(3, 'Who would you like to meet?'),
  note: z.string().trim().max(300, 'Keep the note under 300 characters.'),
});

/* ── actions ───────────────────────────────────────────────────────────── */

function requestVisit(input: {
  parentId: string;
  studentId: string;
  visitorName: string;
  purpose: Visit['purpose'];
  date: string;
  time: string;
  meetingWith: string;
  note: string;
}) {
  const passNo = `VP/${new Date().getFullYear()}/${Math.floor(600 + Math.random() * 399)}`;
  mutate((db) => {
    db.visits.unshift({ ...input, id: newId('vis'), passNo, status: 'requested' });
    db.notifications.unshift({
      id: newId('ntf'),
      userId: input.parentId,
      title: `Visit request ${passNo} sent`,
      body: 'The school office will confirm your appointment shortly.',
      kind: 'system',
      createdOn: new Date().toISOString().slice(0, 19),
      read: false,
      link: '/visits',
    });
  });
  return passNo;
}

function setVisitStatus(id: string, status: Visit['status']) {
  mutate((db) => {
    const visit = db.visits.find((v) => v.id === id);
    if (!visit) return;
    visit.status = status;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (status === 'checked-in') visit.inTime = hhmm;
    if (status === 'completed') visit.outTime = hhmm;

    db.notifications.unshift({
      id: newId('ntf'),
      userId: visit.parentId,
      title: `Visit ${visit.passNo} — ${STATUS_LABEL[status].toLowerCase()}`,
      body:
        status === 'approved'
          ? `Your gate pass is ready for ${formatDate(visit.date)} at ${formatTime(visit.time)}.`
          : `Status updated by the school office.`,
      kind: 'system',
      createdOn: new Date().toISOString().slice(0, 19),
      read: false,
      link: '/visits',
    });
  });
}

/* ── parent: request a visit, carry the pass ──────────────────────────── */

function ParentVisits({ student }: { student: User }) {
  const user = useCurrentUser();
  const db = useDatabase();
  const [open, setOpen] = useState(false);

  const mine = db.visits
    .filter((v) => v.parentId === user.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const upcoming = mine.filter((v) => v.date >= todayISO() && v.status !== 'completed');
  const next = upcoming[upcoming.length - 1];
  const canRequest = useCan()('visit.request');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { purpose: 'Meet a faculty member', date: todayISO(), time: '10:00', meetingWith: '', note: '' },
  });

  return (
    <>
      <PageHeader
        title="School Visits"
        subtitle="Request an appointment and carry your gate pass on your phone."
        action={
          canRequest ? (
            <Button onClick={() => setOpen(true)} icon={<Plus className="size-4" />}>
              Request a visit
            </Button>
          ) : null
        }
      />

      <StatGrid>
        <StatTile
          label="Next visit"
          value={next ? formatDate(next.date, { year: undefined }) : '—'}
          note={next ? `${next.purpose} · ${relativeDay(next.date)}` : 'Nothing scheduled'}
          icon={DoorOpen}
          tone={next ? 'good' : 'neutral'}
        />
        <StatTile label="Awaiting approval" value={mine.filter((v) => v.status === 'requested').length} note="With the school office" icon={Clock} tone={mine.some((v) => v.status === 'requested') ? 'warning' : 'good'} delay={0.06} />
        <StatTile label="Visits this year" value={mine.filter((v) => v.status === 'completed').length} note="Completed" icon={CheckCircle2} delay={0.12} />
        <StatTile label="Student" value={sectionLabel(db, student.sectionId)} note={`${student.name} · roll ${student.rollNo}`} icon={ShieldCheck} delay={0.18} />
      </StatGrid>

      {next ? (
        <MotionCard delay={0.1}>
          <CardHeader title="Your gate pass" subtitle="Show this at the school gate" />
          <CardBody className="pt-4">
            <div className="flex flex-col gap-5 rounded-2xl border border-brand-500/35 bg-brand-500/[0.06] p-5 sm:flex-row sm:items-center">
              <span className="grid size-24 shrink-0 place-items-center rounded-xl bg-surface text-ink-3 shadow-card">
                <QrCode className="size-16" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="tnum text-[18px] font-semibold text-ink">{next.passNo}</p>
                <p className="mt-1 text-[13px] text-ink-2">
                  {next.visitorName} · visiting for {student.name} ({sectionLabel(db, student.sectionId)})
                </p>
                <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
                  {[
                    ['Date', formatDate(next.date)],
                    ['Time', formatTime(next.time)],
                    ['Purpose', next.purpose],
                    ['Meeting', next.meetingWith || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 sm:justify-start">
                      <dt className="text-ink-3 sm:w-20">{k}</dt>
                      <dd className="font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <Badge tone={STATUS_TONE[next.status]}>{STATUS_LABEL[next.status]}</Badge>
            </div>
          </CardBody>
        </MotionCard>
      ) : null}

      <MotionCard delay={0.16} className="mt-5">
        <CardHeader title="Visit history" subtitle={`${mine.length} visits`} />
        <CardBody className="pt-4">
          {mine.length === 0 ? (
            <EmptyState
              icon={<DoorOpen className="size-6" />}
              title="No visits yet"
              description="Request an appointment and your gate pass appears here."
              action={
                canRequest ? (
                  <Button onClick={() => setOpen(true)}>Request a visit</Button>
                ) : null
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {mine.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-3">
                    <DoorOpen className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{v.purpose}</span>
                    <span className="tnum block truncate text-[11.5px] text-ink-3">
                      {v.passNo} · {formatDate(v.date)} at {formatTime(v.time)}
                      {v.inTime ? ` · in ${v.inTime}` : ''}
                      {v.outTime ? ` · out ${v.outTime}` : ''}
                    </span>
                  </span>
                  <Badge tone={STATUS_TONE[v.status]}>{STATUS_LABEL[v.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </MotionCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Request a school visit"
        description="The office confirms your appointment and issues a gate pass."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="visit-form" type="submit" loading={isSubmitting}>Send request</Button>
          </>
        }
      >
        <form
          id="visit-form"
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit(async (values) => {
            await new Promise((r) => setTimeout(r, 350));
            const passNo = requestVisit({
              parentId: user.id,
              studentId: student.id,
              visitorName: user.name,
              purpose: values.purpose,
              date: values.date,
              time: values.time,
              meetingWith: values.meetingWith,
              note: values.note,
            });
            toast.success(`Request ${passNo} sent`, { description: 'The office will confirm shortly.' });
            reset();
            setOpen(false);
          })}
        >
          <Field label="Purpose of visit" error={errors.purpose?.message} required htmlFor="v-purpose">
            <Select id="v-purpose" invalid={!!errors.purpose} {...register('purpose')}>
              {PURPOSES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" error={errors.date?.message} required htmlFor="v-date">
              <Input id="v-date" type="date" min={todayISO()} invalid={!!errors.date} {...register('date')} />
            </Field>
            <Field label="Time" error={errors.time?.message} required htmlFor="v-time">
              <Input id="v-time" type="time" invalid={!!errors.time} {...register('time')} />
            </Field>
          </div>

          <Field label="Who would you like to meet?" error={errors.meetingWith?.message} required htmlFor="v-who">
            <Input id="v-who" placeholder="Class teacher, Principal, Accounts office…" invalid={!!errors.meetingWith} {...register('meetingWith')} />
          </Field>

          <Field label="Anything else?" error={errors.note?.message} hint="Optional — helps the office prepare." htmlFor="v-note">
            <Textarea id="v-note" rows={3} invalid={!!errors.note} {...register('note')} />
          </Field>
        </form>
      </Modal>
    </>
  );
}

/* ── office: the gate register ────────────────────────────────────────── */

function GateRegister() {
  const db = useDatabase();
  const can = useCan();
  const [filter, setFilter] = useState<'today' | 'requested' | 'all'>('today');
  const today = todayISO();

  const all = [...db.visits].sort((a, b) => b.date.localeCompare(a.date));
  const list = all.filter((v) =>
    filter === 'today' ? v.date === today : filter === 'requested' ? v.status === 'requested' : true,
  );

  const rows = list.map((v) => ({ ...v, id: v.id }));

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'visitor',
      header: 'Visitor',
      sortBy: (r) => r.visitorName,
      cell: (r) => {
        const student = userById(db, r.studentId);
        return (
          <div className="flex items-center gap-3">
            <Avatar name={r.visitorName} hue={200} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{r.visitorName}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-3">
                {student ? `${student.name} · ${sectionLabel(db, student.sectionId)}` : '—'}
              </p>
            </div>
          </div>
        );
      },
    },
    { key: 'pass', header: 'Pass no.', hideOnMobile: true, cell: (r) => <span className="tnum">{r.passNo}</span> },
    { key: 'purpose', header: 'Purpose', hideOnMobile: true, sortBy: (r) => r.purpose, cell: (r) => r.purpose },
    {
      key: 'when',
      header: 'When',
      sortBy: (r) => `${r.date}${r.time}`,
      cell: (r) => (
        <span className="tnum">
          {formatDate(r.date, { year: undefined })} · {formatTime(r.time)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', align: 'center', sortBy: (r) => r.status, cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (r) =>
        !can('visit.approve') ? null : r.status === 'requested' ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" onClick={() => { setVisitStatus(r.id, 'approved'); toast.success('Visit approved'); }}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setVisitStatus(r.id, 'rejected'); toast.info('Visit declined'); }}>
              Decline
            </Button>
          </div>
        ) : r.status === 'approved' ? (
          <Button size="sm" variant="secondary" icon={<LogIn className="size-3.5" />} onClick={() => { setVisitStatus(r.id, 'checked-in'); toast.success('Checked in'); }}>
            Check in
          </Button>
        ) : r.status === 'checked-in' ? (
          <Button size="sm" variant="secondary" icon={<LogOut className="size-3.5" />} onClick={() => { setVisitStatus(r.id, 'completed'); toast.success('Checked out'); }}>
            Check out
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="School Visits"
        subtitle="Appointments requested by parents, and the gate register."
        action={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'requested', label: `Pending (${all.filter((v) => v.status === 'requested').length})` },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />

      <StatGrid>
        <StatTile label="Expected today" value={all.filter((v) => v.date === today).length} note="Approved appointments" icon={DoorOpen} />
        <StatTile label="Awaiting approval" value={all.filter((v) => v.status === 'requested').length} note="Parents waiting on the office" icon={Clock} tone={all.some((v) => v.status === 'requested') ? 'warning' : 'good'} delay={0.06} />
        <StatTile label="Inside school now" value={all.filter((v) => v.status === 'checked-in').length} note="Checked in, not yet out" icon={ShieldCheck} tone={all.some((v) => v.status === 'checked-in') ? 'warning' : 'neutral'} delay={0.12} />
        <StatTile label="Completed" value={all.filter((v) => v.status === 'completed').length} note="This academic year" icon={CheckCircle2} delay={0.18} />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader title="Gate register" subtitle={`${list.length} shown`} />
        <CardBody className="pt-4">
          <DataTable
            columns={columns}
            rows={rows}
            initialSort={{ key: 'when', dir: 'desc' }}
            empty={<EmptyState icon={<DoorOpen className="size-6" />} title="No visits here" description="Nothing matches this filter." />}
          />
        </CardBody>
      </MotionCard>
    </>
  );
}

export default function Visits() {
  const user = useCurrentUser();
  const can = useCan();
  const { subject } = useAuth();

  if (can('visit.approve')) return <GateRegister />;
  if (user.roles.includes('parent') || user.roles.includes('student')) {
    if (!subject) return <EmptyState icon={<DoorOpen className="size-6" />} title="No student linked to this account" />;
    return <ParentVisits student={subject} />;
  }
  return <GateRegister />;
}
