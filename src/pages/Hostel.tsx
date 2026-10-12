import { useState } from 'react';
import { toast } from 'sonner';
import { BedDouble, Building2, CheckCircle2, DoorOpen, IndianRupee, Users } from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { hostelFor, hostelOccupancy, hostelRequests, sectionLabel, userById } from '@/lib/queries';
import { decideHostel, requestHostel, vacateHostel } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, EmptyState, PageHeader, Progress, Segmented } from '@/components/ui/misc';
import { cn, formatDate, money } from '@/lib/utils';
import type { User } from '@/data/types';

/**
 * The hostel.
 *
 * What a warden needs is the bed count — how many places exist, how many are
 * taken and who is waiting — and what a parent needs is which room their ward
 * is in and who to telephone. The charge follows from how many share the room,
 * which is how every hostel in the country prices it.
 */

/* ── a resident, or a parent looking at one ──────────────────────────── */

function StudentHostel({ student, canRequest }: { student: User; canRequest: boolean }) {
  const db = useDatabase();
  const place = hostelFor(db, student.id);
  const [asking, setAsking] = useState(false);

  if (place && place.allotment.status !== 'vacated' && place.allotment.status !== 'rejected') {
    const charge = (place.room?.rentPerYear ?? 0) + (place.block?.messCharge ?? 0) * 10;
    return (
      <>
        <PageHeader
          title="Hostel"
          subtitle={`${student.name} · ${sectionLabel(db, student.sectionId)}`}
        />
        <MotionCard delay={0.1}>
          <CardHeader
            title={place.block?.name ?? 'Hostel'}
            subtitle={`Room ${place.room?.number} · floor ${place.room?.floor} · ${place.room?.capacity}-sharing`}
            action={
              <Badge tone={place.allotment.status === 'allotted' ? 'good' : 'warning'}>
                {place.allotment.status === 'allotted' ? 'Allotted' : 'Requested'}
              </Badge>
            }
          />
          <CardBody className="space-y-3 pt-4">
            <dl className="space-y-2 rounded-xl bg-surface-2 px-4 py-3.5 text-[12.5px]">
              {[
                ['Block', place.block?.name ?? '—'],
                ['Room', `${place.room?.number} · ${place.room?.capacity}-sharing`],
                ['Warden', place.warden?.name ?? '—'],
                ['Warden’s phone', place.warden?.phone ?? '—'],
                ['Room rent', money(place.room?.rentPerYear ?? 0) + ' a year'],
                ['Mess charges', money(place.block?.messCharge ?? 0) + ' a month'],
                ['Allotted on', formatDate(place.allotment.allottedOn)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11.5px] leading-relaxed text-ink-3">
              Room rent and ten months of mess charges — {money(charge)} in all — are billed to the
              fee account. Mess bills are revised each semester.
            </p>
          </CardBody>
        </MotionCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Hostel"
        subtitle={`${student.name} · ${sectionLabel(db, student.sectionId)}`}
      />
      <MotionCard delay={0.1}>
        <CardBody>
          <EmptyState
            icon={<BedDouble className="size-6" />}
            title="Not a resident"
            description="A place can be asked for from here; the warden allots rooms as they fall free."
            action={
              canRequest ? <Button onClick={() => setAsking(true)}>Ask for a place</Button> : null
            }
          />
        </CardBody>
      </MotionCard>
      {asking ? <RequestDialog studentId={student.id} onClose={() => setAsking(false)} /> : null}
    </>
  );
}

function RequestDialog({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const db = useDatabase();
  const [blockId, setBlockId] = useState(db.hostelBlocks[0]?.id ?? '');
  const occupancy = hostelOccupancy(db, blockId);
  // Only rooms with a bed actually free are offered.
  const free = occupancy.rooms.filter(
    (r) => (occupancy.byRoom.get(r.id) ?? 0) < r.capacity,
  );
  const [roomId, setRoomId] = useState(free[0]?.id ?? '');

  return (
    <Modal
      open
      onClose={onClose}
      title="Ask for a hostel place"
      description="The warden allots the room; nothing is charged until it is granted."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!roomId}
            onClick={() => {
              requestHostel(studentId, roomId);
              toast.success('Request sent to the warden', {
                description: 'You will be notified once a room is allotted.',
              });
              onClose();
            }}
          >
            Send request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Block" htmlFor="hb">
          <Select
            id="hb"
            value={blockId}
            onChange={(e) => {
              setBlockId(e.target.value);
              setRoomId('');
            }}
          >
            {db.hostelBlocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.forGender}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Room"
          required
          htmlFor="hr"
          hint={`${free.length} rooms have a bed free in this block.`}
        >
          <Select id="hr" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Choose a room…</option>
            {free.map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.number} · {r.capacity}-sharing · {money(r.rentPerYear)} a year
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

/* ── the warden's view ────────────────────────────────────────────────── */

function WardenHostel() {
  const db = useDatabase();
  const can = useCan();
  const manage = can('hostel.manage');
  const [blockId, setBlockId] = useState(db.hostelBlocks[0]?.id ?? '');
  const [tab, setTab] = useState<'rooms' | 'requests'>('rooms');

  const block = db.hostelBlocks.find((b) => b.id === blockId);
  const occupancy = hostelOccupancy(db, blockId);
  const whole = hostelOccupancy(db);
  const requests = hostelRequests(db);

  return (
    <>
      <PageHeader
        title="Hostel"
        subtitle={`${db.hostelBlocks.length} blocks · ${whole.filled} of ${whole.capacity} beds taken`}
        action={
          <>
            <Segmented
              size="sm"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'rooms', label: 'Rooms' },
                { value: 'requests', label: `Requests${requests.length ? ` (${requests.length})` : ''}` },
              ]}
            />
            <Select
              aria-label="Block"
              value={blockId}
              onChange={(e) => setBlockId(e.target.value)}
              className="h-9 min-w-[12rem] text-[13px]"
            >
              {db.hostelBlocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Beds taken"
          value={`${occupancy.filled}/${occupancy.capacity}`}
          note={`${block?.name ?? ''} · ${occupancy.percent}% full`}
          icon={BedDouble}
          tone={occupancy.percent > 90 ? 'warning' : 'good'}
        />
        <StatTile
          label="Beds free"
          value={occupancy.free}
          note="Available to allot in this block"
          icon={DoorOpen}
          tone={occupancy.free ? 'good' : 'critical'}
          delay={0.06}
        />
        <StatTile
          label="Waiting"
          value={requests.length}
          note={requests.length ? 'Requests to decide' : 'Nothing pending'}
          icon={Users}
          tone={requests.length ? 'warning' : 'good'}
          delay={0.12}
        />
        <StatTile
          label="Mess charge"
          value={money(block?.messCharge ?? 0)}
          note="A month, billed with the room rent"
          icon={IndianRupee}
          delay={0.18}
        />
      </StatGrid>

      {tab === 'requests' ? (
        <MotionCard delay={0.1}>
          <CardHeader title="Requests" subtitle="Allot a room or refuse where none is free" />
          <CardBody className="pt-4">
            {requests.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="size-6" />}
                title="Nothing waiting"
                description="Every request has been decided."
              />
            ) : (
              <ul className="space-y-2">
                {requests.map(({ allotment, student, room }) => (
                  <li
                    key={allotment.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3"
                  >
                    <Avatar name={student!.name} hue={student!.avatarHue} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">
                        {student!.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                        {student!.registerNo} · {sectionLabel(db, student!.sectionId)} · asked for
                        room {room?.number}
                      </span>
                    </span>
                    {manage ? (
                      <span className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            decideHostel(allotment.id, 'allotted');
                            toast.success(`Room ${room?.number} allotted`, {
                              description: 'Rent and mess charges have been added to the fee account.',
                            });
                          }}
                        >
                          Allot
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            decideHostel(allotment.id, 'rejected');
                            toast.success('Request refused');
                          }}
                        >
                          Refuse
                        </Button>
                      </span>
                    ) : (
                      <Badge tone="warning">Requested</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </MotionCard>
      ) : (
        <MotionCard delay={0.1}>
          <CardHeader
            title={block?.name ?? 'Block'}
            subtitle={`${occupancy.rooms.length} rooms across ${block?.floors ?? 0} floors`}
          />
          <CardBody className="pt-4">
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {occupancy.rooms.map((room) => {
                const taken = occupancy.byRoom.get(room.id) ?? 0;
                const residents = db.hostelAllotments
                  .filter((a) => a.roomId === room.id && a.status === 'allotted')
                  .map((a) => userById(db, a.studentId))
                  .filter(Boolean);
                return (
                  <li
                    key={room.id}
                    className={cn(
                      'rounded-xl border px-3.5 py-3',
                      taken >= room.capacity
                        ? 'border-line bg-surface-2/60'
                        : 'border-[--color-good]/30 bg-[--color-good]/[0.04]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-semibold text-ink">
                        Room {room.number}
                      </span>
                      <Badge tone={taken >= room.capacity ? 'neutral' : 'good'}>
                        {taken}/{room.capacity}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">
                      Floor {room.floor} · {money(room.rentPerYear)} a year
                    </p>
                    <Progress
                      value={(taken / room.capacity) * 100}
                      tone={taken >= room.capacity ? 'brand' : 'good'}
                      className="mt-2 h-1.5"
                      label={`Room ${room.number} occupancy`}
                    />
                    {residents.length > 0 ? (
                      <p className="mt-1.5 truncate text-[11px] text-ink-3">
                        {residents.map((r) => r!.name).join(', ')}
                      </p>
                    ) : null}
                    {manage && residents.length > 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1.5"
                        onClick={() => {
                          const first = db.hostelAllotments.find(
                            (a) => a.roomId === room.id && a.status === 'allotted',
                          );
                          if (!first) return;
                          vacateHostel(first.id);
                          toast.success(`${userById(db, first.studentId)?.name} vacated`);
                        }}
                      >
                        Vacate one
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </MotionCard>
      )}
    </>
  );
}

export default function Hostel() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const can = useCan();

  if (user.roles.includes('parent') || user.roles.includes('student')) {
    if (!subject) {
      return (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title="No student linked to this account"
          description="Please contact the college office."
        />
      );
    }
    return <StudentHostel student={subject} canRequest={can('hostel.request')} />;
  }

  return <WardenHostel />;
}
