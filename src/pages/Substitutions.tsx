import { useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarOff,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { staffOnLeave, substitutionBoard, userById } from '@/lib/queries';
import { assignSubstitution, cancelSubstitution, decideLeave, requestLeave } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, EmptyState, PageHeader } from '@/components/ui/misc';
import { formatDate, formatTime, todayISO } from '@/lib/utils';
import { DESIGNATION_LABEL } from '@/data/types';
import type { LeaveKind } from '@/data/types';

/**
 * The daily adjustment board — what a school does first thing every morning.
 *
 * A teacher is absent, so each period they were due to take needs someone in
 * front of the class. The useful part is not the list of gaps, it is knowing
 * which teachers are genuinely free in that period, and of those, which can
 * actually teach the subject rather than merely supervise. Both are worked out
 * from the timetable, so the answer is already there when the office opens.
 */

const LEAVE_KINDS: { value: LeaveKind; label: string }[] = [
  { value: 'casual', label: 'Casual leave' },
  { value: 'medical', label: 'Medical leave' },
  { value: 'earned', label: 'Earned leave' },
  { value: 'on-duty', label: 'On duty' },
  { value: 'maternity', label: 'Maternity leave' },
];

export default function Substitutions() {
  const db = useDatabase();
  const can = useCan();
  const me = useCurrentUser();
  const manage = can('substitution.manage');
  const approve = can('leave.approve');

  const [date, setDate] = useState(todayISO());
  const [leaveOpen, setLeaveOpen] = useState(false);

  const board = substitutionBoard(db, date);
  const absent = staffOnLeave(db, date);
  const covered = board.filter((row) => row.cover).length;
  const requests = db.leaves.filter((l) => l.status === 'requested');

  const isToday = date === todayISO();

  return (
    <>
      <PageHeader
        title="Cover and adjustments"
        subtitle={
          isToday
            ? 'Today’s absences and the periods that need someone in front of the class'
            : `Board for ${formatDate(date)}`
        }
        action={
          <>
            <Input
              type="date"
              aria-label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[10.5rem] text-[13px]"
            />
            {can('leave.request') ? (
              <Button
                variant="secondary"
                icon={<CalendarOff className="size-4" />}
                onClick={() => setLeaveOpen(true)}
              >
                Apply for leave
              </Button>
            ) : null}
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Staff absent"
          value={absent.length}
          note={absent.length ? 'On approved leave' : 'Full attendance'}
          icon={UserX}
          tone={absent.length ? 'warning' : 'good'}
        />
        <StatTile
          label="Periods to cover"
          value={board.length}
          note="Lessons without their teacher"
          icon={Clock}
          delay={0.06}
        />
        <StatTile
          label="Cover arranged"
          value={`${covered}/${board.length}`}
          note={covered === board.length && board.length > 0 ? 'Every period is covered' : 'Still to assign'}
          icon={UserCheck}
          tone={board.length === 0 || covered === board.length ? 'good' : 'critical'}
          delay={0.12}
        />
        <StatTile
          label="Leave requests"
          value={requests.length}
          note={approve ? 'Awaiting your approval' : 'Awaiting the Principal'}
          icon={ShieldCheck}
          delay={0.18}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        {/* ── the board ── */}
        <MotionCard delay={0.1}>
          <CardHeader
            title="Periods needing cover"
            subtitle="Teachers who can take the subject are offered first; the rest can supervise"
          />
          <CardBody className="pt-4">
            {board.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="size-6" />}
                title="Nothing to adjust"
                description={
                  absent.length === 0
                    ? 'No member of staff is on leave, so every class has its own teacher.'
                    : 'The absent staff have no periods on this day’s timetable.'
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {board.map(({ slot, section: cls, course: subject, absentFaculty, cover, canTeach, otherFree }) => {
                  const coverTeacher = cover ? userById(db, cover.coverFacultyId) : undefined;
                  return (
                    <li
                      key={slot.id}
                      className="rounded-xl border border-line px-3.5 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-[13px] font-semibold text-ink-2 tnum">
                          P{slot.hour}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-ink">
                            {cls?.label} · {subject?.title ?? slot.title ?? 'Lesson'}
                            {slot.kind === 'lab' ? ' (practical)' : ''}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                            {formatTime(slot.start)}–{formatTime(slot.end)} · {cls?.room} ·{' '}
                            {absentFaculty?.name ?? 'Teacher'} absent
                          </span>
                        </span>

                        {cover ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <Badge tone="good" icon={<UserCheck className="size-3" />}>
                              {coverTeacher?.name ?? 'Covered'}
                            </Badge>
                            {cover.note ? <Badge tone="neutral">Supervision</Badge> : null}
                            {manage ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  cancelSubstitution(cover.id);
                                  toast.success('Cover removed');
                                }}
                              >
                                Change
                              </Button>
                            ) : null}
                          </span>
                        ) : manage ? (
                          <Select
                            aria-label={`Assign cover for period ${slot.hour}, ${cls?.label}`}
                            value=""
                            className="h-9 min-w-[15rem] text-[13px]"
                            onChange={(e) => {
                              const facultyId = e.target.value;
                              if (!facultyId) return;
                              const supervisionOnly = !canTeach.some((t) => t.id === facultyId);
                              assignSubstitution({
                                date,
                                hourId: slot.id,
                                coverFacultyId: facultyId,
                                assignedById: me.id,
                                note: supervisionOnly
                                  ? `Supervision only — not a ${subject?.title ?? 'subject'} teacher.`
                                  : '',
                              });
                              toast.success('Cover assigned', {
                                description: `${userById(db, facultyId)?.name} has been notified.`,
                              });
                            }}
                          >
                            <option value="">Assign cover…</option>
                            {canTeach.length > 0 ? (
                              <optgroup label={`Free and can teach ${subject?.title ?? 'this'}`}>
                                {canTeach.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                    {t.designation ? ` · ${DESIGNATION_LABEL[t.designation]}` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null}
                            {otherFree.length > 0 ? (
                              <optgroup label="Free — supervision only">
                                {otherFree.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                    {t.designation ? ` · ${DESIGNATION_LABEL[t.designation]}` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null}
                          </Select>
                        ) : (
                          <Badge tone="critical">Not yet covered</Badge>
                        )}
                      </div>

                      {!cover && canTeach.length === 0 && otherFree.length === 0 ? (
                        <p className="mt-2 text-[12px] text-[--color-critical]">
                          Every teacher is already engaged in this period. The class will need to be
                          merged or sent to the library.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </MotionCard>

        {/* ── who is away, and requests to decide ── */}
        <div className="space-y-5">
          <MotionCard delay={0.16}>
            <CardHeader title="Away today" subtitle="Approved leave covering this date" />
            <CardBody className="pt-4">
              {absent.length === 0 ? (
                <EmptyState
                  icon={<UserCheck className="size-6" />}
                  title="Everyone is in"
                  description="No approved leave covers this date."
                />
              ) : (
                <ul className="space-y-2">
                  {absent.map(({ leave, staff }) => (
                    <li
                      key={leave.id}
                      className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5"
                    >
                      <Avatar name={staff!.name} hue={staff!.avatarHue} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">
                          {staff!.name}
                        </span>
                        <span className="block truncate text-[11.5px] text-ink-3">
                          {leave.kind} leave · {formatDate(leave.from)} to {formatDate(leave.to)}
                        </span>
                      </span>
                      <Badge tone="warning">Absent</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </MotionCard>

          <MotionCard delay={0.22}>
            <CardHeader
              title="Leave requests"
              subtitle={approve ? 'Approve or decline' : 'Pending with the Principal'}
            />
            <CardBody className="pt-4">
              {requests.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="size-6" />}
                  title="Nothing pending"
                  description="Every leave request has been decided."
                />
              ) : (
                <ul className="space-y-2">
                  {requests.map((leave) => {
                    const staff = userById(db, leave.staffId);
                    return (
                      <li key={leave.id} className="rounded-xl border border-line px-3.5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={staff?.name ?? '?'} hue={staff?.avatarHue ?? 0} size="md" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-ink">
                              {staff?.name ?? 'Member of staff'}
                            </span>
                            <span className="block truncate text-[11.5px] text-ink-3">
                              {leave.kind} · {formatDate(leave.from)} to {formatDate(leave.to)}
                            </span>
                          </span>
                        </div>
                        <p className="mt-2 text-[12.5px] text-ink-2">{leave.reason}</p>
                        {approve ? (
                          <div className="mt-2.5 flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                decideLeave(leave.id, 'approved', me.id);
                                toast.success('Leave approved', {
                                  description: 'Their periods now appear on the cover board.',
                                });
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                decideLeave(leave.id, 'rejected', me.id);
                                toast.success('Leave declined');
                              }}
                            >
                              Decline
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
        </div>
      </div>

      <LeaveDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} staffId={me.id} />
    </>
  );
}

/* ── applying for leave ───────────────────────────────────────────────── */

function LeaveDialog({
  open,
  onClose,
  staffId,
}: {
  open: boolean;
  onClose: () => void;
  staffId: string;
}) {
  const [kind, setKind] = useState<LeaveKind>('casual');
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [reason, setReason] = useState('');

  const invalid = to < from || reason.trim().length < 5;

  const submit = () => {
    if (invalid) return;
    requestLeave({ staffId, kind, from, to, reason: reason.trim() });
    toast.success('Leave requested', {
      description: 'The Principal has been notified so cover can be arranged.',
    });
    setReason('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply for leave"
      description="Once approved, your periods appear on the cover board for whoever arranges adjustments."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={invalid}>
            Submit request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type of leave" htmlFor="lk">
          <Select id="lk" value={kind} onChange={(e) => setKind(e.target.value as LeaveKind)}>
            {LEAVE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" required htmlFor="lf">
            <Input id="lf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field
            label="To"
            required
            htmlFor="lt"
            error={to < from ? 'The end date cannot be before the start.' : undefined}
          >
            <Input
              id="lt"
              type="date"
              value={to}
              invalid={to < from}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Reason" required htmlFor="lr">
          <Textarea
            id="lr"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Family function at Pollachi. Medical certificate will follow."
          />
        </Field>
      </div>
    </Modal>
  );
}
