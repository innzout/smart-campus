import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarCheck, Clock, MessageSquare, Users } from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { mutate, useDatabase, newId } from '@/lib/store';
import { classById, classLabel, userById } from '@/lib/queries';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, EmptyState, PageHeader } from '@/components/ui/misc';
import { cn, formatDate, formatTime, relativeDay, todayISO } from '@/lib/utils';
import type { MeetingSlot, User } from '@/data/types';

/* ── actions kept local: meetings are only used on this page ──────────── */

function bookSlot(slotId: string, parentId: string, studentId: string, note: string) {
  mutate((db) => {
    // One booking per child — rebooking moves the existing one.
    const existing = db.meetingBookings.find(
      (b) => b.studentId === studentId && b.status === 'booked',
    );
    if (existing) {
      existing.slotId = slotId;
      existing.note = note;
      existing.bookedOn = todayISO();
      return;
    }
    db.meetingBookings.push({
      id: newId('mb'),
      slotId,
      parentId,
      studentId,
      bookedOn: todayISO(),
      status: 'booked',
      note,
      teacherNote: '',
    });
  });
}

function cancelBooking(bookingId: string) {
  mutate((db) => {
    const booking = db.meetingBookings.find((b) => b.id === bookingId);
    if (booking) booking.status = 'cancelled';
  });
}

function addTeacherNote(bookingId: string, note: string) {
  mutate((db) => {
    const booking = db.meetingBookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.teacherNote = note;
      booking.status = 'completed';
    }
  });
}

/* ── parent: book a slot ──────────────────────────────────────────────── */

function ParentMeetings({ student }: { student: User }) {
  const user = useCurrentUser();
  const db = useDatabase();
  const [note, setNote] = useState('');
  const [choosing, setChoosing] = useState<MeetingSlot | null>(null);
  const canBook = useCan()('meeting.book');

  const cls = classById(db, student.classId);
  const slots = db.meetingSlots.filter((s) => s.classId === student.classId);
  const booking = db.meetingBookings.find(
    (b) => b.studentId === student.id && b.status !== 'cancelled',
  );
  const bookedSlot = booking ? slots.find((s) => s.id === booking.slotId) : undefined;
  const teacher = userById(db, cls?.classTeacherId);

  const takenCount = (slotId: string) =>
    db.meetingBookings.filter((b) => b.slotId === slotId && b.status === 'booked').length;

  const past = db.meetingBookings.filter(
    (b) => b.studentId === student.id && b.status === 'completed',
  );

  return (
    <>
      <PageHeader
        title="Parent–Teacher Meeting"
        subtitle={
          slots.length
            ? `${formatDate(slots[0]!.date)} · ${cls?.label} · with ${teacher?.name ?? 'the class teacher'}`
            : 'No meeting scheduled at the moment.'
        }
      />

      <StatGrid>
        <StatTile
          label="Your slot"
          value={bookedSlot ? formatTime(bookedSlot.start) : 'Not booked'}
          note={bookedSlot ? `${formatDate(bookedSlot.date)} · ${relativeDay(bookedSlot.date)}` : 'Pick a time below'}
          icon={CalendarCheck}
          tone={bookedSlot ? 'good' : 'warning'}
        />
        <StatTile label="Class teacher" value={cls?.label ?? '—'} note={teacher?.name ?? '—'} icon={Users} delay={0.06} />
        <StatTile label="Slots left" value={slots.filter((s) => takenCount(s.id) < s.capacity).length} note={`Of ${slots.length} on the day`} icon={Clock} delay={0.12} />
        <StatTile label="Past meetings" value={past.length} note="With teacher remarks" icon={MessageSquare} delay={0.18} />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader
          title="Choose a time"
          subtitle={bookedSlot ? 'Tap another slot to move your booking.' : 'Tap a slot to book it.'}
          action={
            booking && bookedSlot ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  cancelBooking(booking.id);
                  toast.info('Booking cancelled');
                }}
              >
                Cancel booking
              </Button>
            ) : null
          }
        />
        <CardBody className="pt-4">
          {slots.length === 0 ? (
            <EmptyState icon={<CalendarCheck className="size-6" />} title="No meeting scheduled" description="The school will announce the next PTM by circular." />
          ) : (
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {slots.map((slot) => {
                const taken = takenCount(slot.id);
                const full = taken >= slot.capacity;
                const mine = bookedSlot?.id === slot.id;
                return (
                  <button
                    key={slot.id}
                    disabled={full && !mine}
                    onClick={() => (canBook ? setChoosing(slot) : undefined)}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      mine
                        ? 'border-brand-500/55 bg-brand-500/10'
                        : full
                          ? 'border-line bg-surface-2'
                          : 'border-line bg-surface hover:border-brand-500/40',
                    )}
                  >
                    <span className="tnum block text-[14px] font-semibold text-ink">
                      {formatTime(slot.start)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-3">
                      {mine ? 'Your slot' : full ? 'Full' : `${slot.capacity - taken} free`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardBody>
      </MotionCard>

      {past.length ? (
        <MotionCard delay={0.16} className="mt-5">
          <CardHeader title="Previous meetings" subtitle="What the teacher noted" />
          <CardBody className="pt-4">
            <ul className="divide-y divide-line">
              {past.map((b) => {
                const slot = db.meetingSlots.find((s) => s.id === b.slotId);
                return (
                  <li key={b.id} className="py-3">
                    <p className="text-[13px] font-semibold text-ink">
                      {slot ? formatDate(slot.date) : formatDate(b.bookedOn)}
                    </p>
                    {b.teacherNote ? (
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{b.teacherNote}</p>
                    ) : (
                      <p className="mt-1 text-[12.5px] text-ink-3">No remarks recorded.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </MotionCard>
      ) : null}

      <Modal
        open={!!choosing}
        onClose={() => setChoosing(null)}
        title={choosing ? `Book ${formatTime(choosing.start)}` : ''}
        description={choosing ? `${formatDate(choosing.date)} · with ${teacher?.name}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setChoosing(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!choosing) return;
                bookSlot(choosing.id, user.id, student.id, note);
                toast.success('Meeting booked', {
                  description: `${formatDate(choosing.date)} at ${formatTime(choosing.start)}.`,
                });
                setChoosing(null);
                setNote('');
              }}
            >
              Confirm booking
            </Button>
          </>
        }
      >
        <label className="block text-[13px] font-medium text-ink-2" htmlFor="m-note">
          Anything you would like to discuss? <span className="text-ink-3">(optional)</span>
        </label>
        <Textarea
          id="m-note"
          rows={4}
          className="mt-2"
          placeholder="For example: progress in Mathematics, or attendance."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Modal>
    </>
  );
}

/* ── teacher / office: the appointment book ───────────────────────────── */

function StaffMeetings() {
  const user = useCurrentUser();
  const db = useDatabase();
  const can = useCan();

  const myClass = db.classes.find((c) => c.classTeacherId === user.id);
  const [classId, setClassId] = useState(myClass?.id ?? db.classes[0]?.id ?? '');
  const slots = db.meetingSlots.filter((s) => s.classId === classId);
  const [noting, setNoting] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const bookingsFor = (slotId: string) =>
    db.meetingBookings.filter((b) => b.slotId === slotId && b.status !== 'cancelled');

  const booked = db.meetingBookings.filter(
    (b) => slots.some((s) => s.id === b.slotId) && b.status === 'booked',
  );

  return (
    <>
      <PageHeader
        title="Parent–Teacher Meeting"
        subtitle={slots.length ? `${formatDate(slots[0]!.date)} · appointments for ${classLabel(db, classId)}` : 'No meeting scheduled.'}
        action={
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            aria-label="Class"
            className="h-9 rounded-xl border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-500"
          >
            {db.classes.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        }
      />

      <StatGrid>
        <StatTile label="Appointments" value={booked.length} note={`Across ${slots.length} slots`} icon={CalendarCheck} />
        <StatTile label="Slots free" value={slots.filter((s) => bookingsFor(s.id).length < s.capacity).length} note="Still bookable" icon={Clock} delay={0.06} />
        <StatTile label="Parents yet to book" value={Math.max(0, db.users.filter((u) => u.roles.includes('student') && u.classId === classId).length - booked.length)} note="Consider a reminder circular" icon={Users} tone="warning" delay={0.12} />
        <StatTile label="Remarks recorded" value={db.meetingBookings.filter((b) => b.teacherNote).length} note="After the meeting" icon={MessageSquare} delay={0.18} />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader title="Appointment book" subtitle="Who is coming, and when" />
        <CardBody className="pt-4">
          {slots.length === 0 ? (
            <EmptyState icon={<CalendarCheck className="size-6" />} title="No meeting scheduled" />
          ) : (
            <ul className="space-y-2">
              {slots.map((slot) => {
                const rows = bookingsFor(slot.id);
                return (
                  <li key={slot.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="tnum text-[14px] font-semibold text-ink">
                        {formatTime(slot.start)} – {formatTime(slot.end)}
                      </span>
                      <Badge tone={rows.length ? 'info' : 'neutral'}>
                        {rows.length} of {slot.capacity} booked
                      </Badge>
                    </div>

                    {rows.length ? (
                      <ul className="mt-3 space-y-2">
                        {rows.map((b) => {
                          const student = userById(db, b.studentId);
                          const parent = userById(db, b.parentId);
                          if (!student) return null;
                          return (
                            <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
                              <Avatar name={student.name} hue={student.avatarHue} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold text-ink">
                                  {student.name}
                                  <span className="ml-2 font-normal text-ink-3">roll {student.rollNo}</span>
                                </span>
                                <span className="block truncate text-[11.5px] text-ink-3">
                                  {parent?.name} · {parent?.phone}
                                </span>
                                {b.note ? (
                                  <span className="mt-1 block text-[12px] text-ink-2">“{b.note}”</span>
                                ) : null}
                                {b.teacherNote ? (
                                  <span className="mt-1 block text-[12px] text-ink-2">
                                    <span className="font-medium text-ink">Your remark:</span> {b.teacherNote}
                                  </span>
                                ) : null}
                              </span>
                              {can('meeting.manage') && b.status === 'booked' ? (
                                <Button size="sm" variant="ghost" onClick={() => { setNoting(b.id); setNote(''); }}>
                                  Add remark
                                </Button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[12.5px] text-ink-3">No bookings yet.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </MotionCard>

      <Modal
        open={!!noting}
        onClose={() => setNoting(null)}
        title="Record a remark"
        description="The parent sees this in their app after the meeting."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoting(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!noting || !note.trim()) {
                  toast.error('Write a short remark first.');
                  return;
                }
                addTeacherNote(noting, note.trim());
                toast.success('Remark saved', { description: 'The parent has been notified.' });
                setNoting(null);
              }}
            >
              Save remark
            </Button>
          </>
        }
      >
        <Textarea
          rows={5}
          placeholder="For example: good progress in Science; needs regular revision in Mathematics."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Remark"
        />
      </Modal>
    </>
  );
}

export default function Meetings() {
  const user = useCurrentUser();
  const { subject } = useAuth();

  if (user.roles.includes('parent') || user.roles.includes('student')) {
    if (!subject) return <EmptyState icon={<Users className="size-6" />} title="No student linked to this account" />;
    return <ParentMeetings student={subject} />;
  }
  return <StaffMeetings />;
}
