import { useState } from 'react';
import { Bus, Clock, MapPin, Phone, Users } from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  classLabel,
  routeRiders,
  transportFor,
  vehicleCompliance,
  vehicleForRoute,
} from '@/lib/queries';
import {
  assignTransport,
  decideTransport,
  requestTransport,
  saveRoute,
  updateVehiclePapers,
} from '@/lib/actions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { studentsOf } from '@/lib/queries';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Avatar, EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { BarList } from '@/components/charts/Charts';
import { cn, daysFromToday, formatDate, formatTime, money, num } from '@/lib/utils';
import type { User } from '@/data/types';

/* ── the stop list, which is what a parent actually wants ─────────────── */

function RouteStops({ routeId, highlight }: { routeId: string; highlight?: string }) {
  const db = useDatabase();
  const route = db.routes.find((r) => r.id === routeId);
  if (!route) return null;

  return (
    <ol className="relative space-y-0">
      {route.stops.map((stop, i) => {
        const mine = stop.name === highlight;
        return (
          <li key={stop.name} className="relative flex gap-4 pb-5 last:pb-0">
            {i < route.stops.length - 1 ? (
              <span className="absolute top-5 bottom-0 left-[3.3rem] w-px bg-line" aria-hidden />
            ) : null}
            <span className="tnum min-w-12 shrink-0 pt-0.5 text-right text-[11.5px] font-medium whitespace-nowrap text-ink-3">
              {formatTime(stop.time)}
            </span>
            <span
              className={cn(
                'relative z-10 mt-1 size-2.5 shrink-0 rounded-full ring-[3px] ring-surface',
                mine ? 'bg-brand-500' : 'bg-line-strong',
              )}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[13.5px]', mine ? 'font-semibold text-ink' : 'text-ink-2')}>
                {stop.name}
              </span>
              {mine ? <span className="mt-0.5 block text-[11.5px] text-brand-600 dark:text-brand-300">Your stop</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── parent / student ──────────────────────────────────────────────────── */

function ChildTransport({ student }: { student: User }) {
  const db = useDatabase();
  const link = transportFor(db, student.id);

  if (!link) {
    return (
      <>
        <PageHeader title="Transport" subtitle={`${student.name} · ${classLabel(db, student.classId)}`} />
        <MotionCard>
          <EmptyState
            icon={<Bus className="size-6" />}
            title="Not using the school bus"
            description="Contact the school office if you would like to apply for transport."
          />
        </MotionCard>
      </>
    );
  }

  const { route, stop, pickup, vehicle } = link;

  return (
    <>
      <PageHeader
        title="Transport"
        subtitle={`${student.name} · ${classLabel(db, student.classId)} · ${route.name}`}
      />

      <StatGrid>
        <StatTile label="Pickup time" value={pickup ? formatTime(pickup.time) : '—'} note={stop} icon={Clock} tone="good" />
        <StatTile label="Bus number" value={vehicle?.busNo ?? '—'} note={route.name} icon={Bus} delay={0.06} />
        <StatTile label="Driver" value={vehicle?.driverName ?? '—'} note={vehicle?.driverPhone ?? ''} icon={Phone} delay={0.12} />
        <StatTile label="Annual bus fee" value={money(route.fee)} note="Billed across three terms" icon={MapPin} delay={0.18} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <MotionCard delay={0.1}>
          <CardHeader title="Route and stops" subtitle={`${route.name} · ${vehicle?.busNo ?? ''}`} />
          <CardBody className="pt-4">
            <RouteStops routeId={route.id} highlight={stop} />
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader title="Driver and bus" subtitle="Who to call if the bus is late" />
          <CardBody className="space-y-3 pt-4">
            <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
              <Avatar name={vehicle?.driverName ?? 'Driver'} hue={30} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{vehicle?.driverName ?? '—'}</span>
                <span className="block text-[12px] text-ink-3">Driver · {vehicle?.busNo}</span>
              </span>
              <a
                href={`tel:${(vehicle?.driverPhone ?? '').replace(/\s/g, '')}`}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-600 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-500"
              >
                <Phone className="size-3.5" /> Call
              </a>
            </div>

            <dl className="space-y-2 rounded-xl bg-surface-2 px-4 py-3.5 text-[12.5px]">
              {[
                ['Route', route.name],
                ['Boarding point', stop],
                ['Morning pickup', pickup ? formatTime(pickup.time) : '—'],
                ['Stops on route', String(route.stops.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            <p className="text-[11.5px] leading-relaxed text-ink-3">
              Children should be at the stop five minutes before the scheduled time. Changes to the
              boarding point can be requested through the Help Desk.
            </p>
          </CardBody>
        </MotionCard>
      </div>
    </>
  );
}

/* ── staff: all routes ────────────────────────────────────────────────── */

function AllRoutes() {
  const db = useDatabase();
  const [routeId, setRouteId] = useState(db.routes[0]?.id ?? '');
  const route = db.routes.find((r) => r.id === routeId);
  const riders = routeId ? routeRiders(db, routeId) : [];

  const usage = db.routes.map((r) => ({
    name: r.name.replace(/^Route \d+ — /, ''),
    value: routeRiders(db, r.id).length,
    meta: `${r.name} · ${vehicleForRoute(db, r.id)?.busNo ?? ""}`,
  }));

  const routeVehicle = vehicleForRoute(db, routeId);
  const totalRiders = db.studentTransport.filter((t) => t.status === 'allotted').length;
  const canAct = useCan();
  const canManage = canAct('transport.manage');
  const canSeePapers = canAct('transport.compliance');
  const pending = db.studentTransport.filter(
    (t) => t.status === 'requested' || t.status === 'approved',
  );
  const lapsed = vehicleCompliance(db);
  const [tab, setTab] = useState<'routes' | 'requests' | 'vehicles'>('routes');
  const [editingRoute, setEditingRoute] = useState<string | 'new' | null>(null);
  const [allotOpen, setAllotOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Transport"
        subtitle={`${db.routes.length} routes · ${num(totalRiders)} students use the school bus`}
        action={
          <Segmented
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'routes', label: 'Routes' },
              { value: 'requests', label: `Requests${pending.length ? ` (${pending.length})` : ''}` },
              ...(canSeePapers ? [{ value: 'vehicles' as const, label: 'Vehicles' }] : []),
            ]}
          />
        }
      />

      <StatGrid>
        <StatTile label="Routes" value={db.routes.length} note="Operating daily" icon={Bus} />
        <StatTile label="Students on bus" value={num(totalRiders)} note={`${Math.round((totalRiders / db.users.filter((u) => u.roles.includes('student')).length) * 100)}% of the school`} icon={Users} delay={0.06} />
        <StatTile
          label="Awaiting allotment"
          value={pending.length}
          note={pending.length ? 'Parents have asked for a seat' : 'Nothing pending'}
          icon={MapPin}
          tone={pending.length ? 'warning' : 'good'}
          delay={0.12}
        />
        <StatTile
          label="Papers expiring"
          value={lapsed.length}
          note={
            lapsed.some((l) => l.daysLeft < 0)
              ? 'One or more have already lapsed'
              : lapsed.length
                ? 'Renew before they expire'
                : 'All current'
          }
          icon={Clock}
          tone={lapsed.some((l) => l.daysLeft < 0) ? 'critical' : lapsed.length ? 'warning' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      {tab === 'requests' ? <RequestQueue canManage={canManage} /> : null}
      {tab === 'vehicles' && canSeePapers ? <VehicleBoard canManage={canManage} /> : null}

      {tab !== 'routes' ? null : (
      <>
      <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
        {canManage ? (
          <>
            {/* The office puts children on a bus far more often than a parent
                asks — a new admission is allotted at the counter. */}
            <Button
              size="sm"
              variant="secondary"
              icon={<Users className="size-3.5" />}
              onClick={() => setAllotOpen(true)}
            >
              Allot a student
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<MapPin className="size-3.5" />}
              onClick={() => setEditingRoute(routeId)}
            >
              Edit route
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditingRoute('new')}>
              New route
            </Button>
          </>
        ) : null}
        <Segmented
          size="sm"
          value={routeId}
          onChange={setRouteId}
          options={db.routes.map((r) => ({
            value: r.id,
            label: r.name.replace(/^Route (\d+).*/, 'R$1'),
          }))}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <MotionCard delay={0.1}>
          <CardHeader title="Students per route" subtitle="Where the demand is" />
          <CardBody className="pt-2">
            <BarList data={usage} valueLabel="Students" height={230} />
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader
            title={route?.name ?? 'Route'}
            subtitle={
              route
                ? [routeVehicle?.busNo, routeVehicle?.driverName, routeVehicle?.driverPhone]
                    .filter(Boolean)
                    .join(' · ')
                : ''
            }
          />
          <CardBody className="pt-4">
            {route ? <RouteStops routeId={route.id} /> : null}
          </CardBody>
        </MotionCard>
      </div>

      <MotionCard delay={0.2} className="mt-5">
        <CardHeader title="Students on this route" subtitle={`${riders.length} children`} />
        <CardBody className="pt-4">
          {riders.length === 0 ? (
            <EmptyState icon={<Bus className="size-6" />} title="No students on this route" />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {riders.map(({ link, student }) => (
                <li key={link.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                  <Avatar name={student!.name} hue={student!.avatarHue} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{student!.name}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">
                      {classLabel(db, student!.classId)} · {link.stop}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </MotionCard>
      </>
      )}

      {editingRoute ? (
        <RouteDialog
          routeId={editingRoute === 'new' ? null : editingRoute}
          onClose={() => setEditingRoute(null)}
          onSaved={setRouteId}
        />
      ) : null}
      {allotOpen ? <AllotDialog onClose={() => setAllotOpen(false)} /> : null}
    </>
  );
}

/* ── the office putting a child on a bus ─────────────────────────────── */

/**
 * Allotment from the counter, which is how most children actually get a seat:
 * a parent asks at admission, not through the app. Seats remaining are shown
 * because that is the only thing that decides the answer.
 */
function AllotDialog({ onClose }: { onClose: () => void }) {
  const db = useDatabase();
  const [routeId, setRouteId] = useState(db.routes[0]?.id ?? '');
  const [studentId, setStudentId] = useState('');
  const [stop, setStop] = useState('');

  const route = db.routes.find((r) => r.id === routeId);
  const vehicle = vehicleForRoute(db, routeId);
  const taken = db.studentTransport.filter(
    (t) => t.routeId === routeId && t.status === 'allotted',
  ).length;
  const seatsLeft = (vehicle?.capacity ?? 0) - taken;

  // Children not already holding a seat, so the list is the useful one.
  const riding = new Set(
    db.studentTransport.filter((t) => t.status === 'allotted').map((t) => t.studentId),
  );
  const candidates = studentsOf(db)
    .filter((st) => !riding.has(st.id))
    .sort((a, b) => classLabel(db, a.classId).localeCompare(classLabel(db, b.classId)));

  return (
    <Modal
      open
      onClose={onClose}
      title="Allot a bus seat"
      description="For a child whose parent has asked at the office rather than through the app."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!studentId || !stop || seatsLeft <= 0}
            onClick={() => {
              assignTransport(studentId, routeId, stop);
              toast.success('Seat allotted', {
                description: 'The bus fee has been raised and the parent notified.',
              });
              onClose();
            }}
          >
            {seatsLeft <= 0 ? 'Bus full' : 'Allot seat'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Route"
          required
          htmlFor="ar"
          hint={
            vehicle
              ? `${vehicle.busNo} · ${seatsLeft} of ${vehicle.capacity} seats free`
              : undefined
          }
        >
          <Select
            id="ar"
            value={routeId}
            onChange={(e) => {
              setRouteId(e.target.value);
              setStop('');
            }}
          >
            {db.routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {money(r.fee)} a year
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Student" required htmlFor="as2" hint="Children already on a bus are not listed.">
          <Select id="as2" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Choose a student…</option>
            {candidates.map((st) => (
              <option key={st.id} value={st.id}>
                {classLabel(db, st.classId)} · {st.name} · roll {st.rollNo}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Boarding point" required htmlFor="ast">
          <Select id="ast" value={stop} onChange={(e) => setStop(e.target.value)}>
            <option value="">Choose a stop…</option>
            {route?.stops.map((st) => (
              <option key={st.name} value={st.name}>
                {st.name} · {formatTime(st.time)}
              </option>
            ))}
          </Select>
        </Field>

        {seatsLeft <= 0 ? (
          <p className="text-[12.5px] text-[--color-critical]">
            This bus is full. Choose another route or add a vehicle before allotting.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/* ── adding and editing a route ──────────────────────────────────────── */

/**
 * Routes change every year — a new layout opens up, a stop moves, the bus is
 * swapped. Stops are edited as a list because their order is the route: the
 * pickup times a parent reads off follow from it.
 */
function RouteDialog({
  routeId,
  onClose,
  onSaved,
}: {
  routeId: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const db = useDatabase();
  const existing = routeId ? db.routes.find((r) => r.id === routeId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [vehicleId, setVehicleId] = useState(existing?.vehicleId ?? db.vehicles[0]?.id ?? '');
  const [fee, setFee] = useState(existing?.fee ?? 9000);
  const [stops, setStops] = useState<{ name: string; time: string }[]>(
    existing?.stops.map((st) => ({ ...st })) ?? [{ name: '', time: '07:00' }],
  );

  const named = stops.filter((st) => st.name.trim());
  const valid = name.trim().length > 3 && vehicleId && named.length >= 2;

  // A bus already carrying more children than the new one seats is a problem
  // worth naming before it is saved, not after.
  const riders = routeId
    ? db.studentTransport.filter((t) => t.routeId === routeId && t.status === 'allotted').length
    : 0;
  const chosen = db.vehicles.find((v) => v.id === vehicleId);
  const tooSmall = !!chosen && riders > chosen.capacity;

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? existing.name : 'New route'}
      description="Stops are listed in the order the bus reaches them."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || tooSmall}
            onClick={() => {
              saveRoute({
                id: existing?.id,
                name: name.trim(),
                vehicleId,
                fee,
                stops: named.map((st) => ({ name: st.name.trim(), time: st.time })),
              });
              toast.success(existing ? 'Route updated' : 'Route added', {
                description: `${named.length} stops · ${money(fee)} a year.`,
              });
              if (existing) onSaved(existing.id);
              onClose();
            }}
          >
            {existing ? 'Save route' : 'Add route'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Route name" required htmlFor="rn">
          <Input
            id="rn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Route 5 — Kovaipudur"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Bus"
            required
            htmlFor="rv"
            error={tooSmall ? `${riders} children ride this route; this bus seats ${chosen?.capacity}.` : undefined}
          >
            <Select id="rv" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              {db.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.busNo} · {v.capacity} seats
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Annual fee (₹)" htmlFor="rf" hint="Billed across three terms.">
            <Input
              id="rf"
              type="number"
              min={0}
              step={500}
              value={fee}
              onChange={(e) => setFee(Number(e.target.value))}
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
            Stops
          </p>
          <ul className="space-y-2">
            {stops.map((st, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-[12px] text-ink-3 tnum">{i + 1}</span>
                <Input
                  aria-label={`Stop ${i + 1} name`}
                  value={st.name}
                  placeholder="Stop name"
                  className="h-9 flex-1 text-[13px]"
                  onChange={(e) =>
                    setStops((prev) =>
                      prev.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  aria-label={`Stop ${i + 1} time`}
                  type="time"
                  value={st.time}
                  className="h-9 w-28 text-[13px]"
                  onChange={(e) =>
                    setStops((prev) =>
                      prev.map((x, k) => (k === i ? { ...x, time: e.target.value } : x)),
                    )
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={stops.length <= 1}
                  onClick={() => setStops((prev) => prev.filter((_, k) => k !== i))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => setStops((prev) => [...prev, { name: '', time: '07:00' }])}
          >
            Add a stop
          </Button>
          {named.length < 2 ? (
            <p className="mt-2 text-[12px] text-ink-3">A route needs at least two named stops.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

/* ── the allotment queue ──────────────────────────────────────────────── */

/**
 * Parents ask for a seat; the office allots one. Seat count is the thing that
 * decides it, so the bus's capacity and what is already taken are shown against
 * every request rather than left for someone to work out.
 */
function RequestQueue({ canManage }: { canManage: boolean }) {
  const db = useDatabase();
  const pending = db.studentTransport.filter(
    (t) => t.status === 'requested' || t.status === 'approved',
  );

  if (pending.length === 0) {
    return (
      <MotionCard delay={0.1}>
        <CardBody>
          <EmptyState
            icon={<Bus className="size-6" />}
            title="No transport requests waiting"
            description="Requests from parents appear here for the office to allot a seat."
          />
        </CardBody>
      </MotionCard>
    );
  }

  return (
    <MotionCard delay={0.1}>
      <CardHeader
        title="Transport requests"
        subtitle="Seats taken against the bus's capacity decide whether a request can be met"
      />
      <CardBody className="pt-4">
        <ul className="space-y-2">
          {pending.map((link) => {
            const student = db.users.find((u) => u.id === link.studentId);
            const route = db.routes.find((r) => r.id === link.routeId);
            const vehicle = vehicleForRoute(db, link.routeId);
            const taken = db.studentTransport.filter(
              (t) => t.routeId === link.routeId && t.status === 'allotted',
            ).length;
            const full = !!vehicle && taken >= vehicle.capacity;

            return (
              <li
                key={link.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3"
              >
                {student ? (
                  <Avatar name={student.name} hue={student.avatarHue} size="md" />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">
                    {student?.name ?? 'Student'}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                    {classLabel(db, student?.classId)} · {route?.name} · boarding at {link.stop} ·
                    asked {formatDate(link.requestedOn)}
                  </span>
                </span>

                <Badge tone={full ? 'critical' : 'neutral'}>
                  {taken}/{vehicle?.capacity ?? '—'} seats taken
                </Badge>
                <Badge tone={link.status === 'approved' ? 'info' : 'warning'}>
                  {link.status === 'approved' ? 'Approved' : 'Requested'}
                </Badge>

                {canManage ? (
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={full}
                      onClick={() => {
                        decideTransport(link.id, 'allotted');
                        toast.success('Seat allotted', {
                          description: 'The bus fee has been raised and the parent notified.',
                        });
                      }}
                    >
                      {full ? 'Bus full' : 'Allot seat'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        decideTransport(link.id, 'rejected');
                        toast.success('Request declined');
                      }}
                    >
                      Decline
                    </Button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardBody>
    </MotionCard>
  );
}

/* ── vehicles and their papers ────────────────────────────────────────── */

/**
 * The compliance side of transport. A school running a bus on a lapsed fitness
 * certificate is the sort of thing that closes a transport operation, so expiry
 * is surfaced rather than filed.
 */
function VehicleBoard({ canManage }: { canManage: boolean }) {
  const db = useDatabase();
  const [editing, setEditing] = useState<string | null>(null);
  const vehicle = db.vehicles.find((v) => v.id === editing);

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        {db.vehicles.map((v, i) => {
          const route = db.routes.find((r) => r.vehicleId === v.id);
          const taken = route
            ? db.studentTransport.filter((t) => t.routeId === route.id && t.status === 'allotted')
                .length
            : 0;
          const papers: [string, string][] = [
            ['Fitness certificate', v.fcExpiry],
            ['Insurance', v.insuranceExpiry],
            ['Permit', v.permitExpiry],
          ];

          return (
            <MotionCard key={v.id} delay={0.1 + i * 0.05}>
              <CardHeader
                title={v.busNo}
                subtitle={`${v.model} · ${route?.name ?? 'Not on a route'}`}
                action={
                  <Badge tone={taken > v.capacity ? 'critical' : 'neutral'}>
                    {taken}/{v.capacity} seats
                  </Badge>
                }
              />
              <CardBody className="space-y-3 pt-4">
                <dl className="space-y-2 rounded-xl bg-surface-2 px-4 py-3 text-[12.5px]">
                  {[
                    ['Driver', `${v.driverName} · ${v.driverPhone}`],
                    ['Licence', v.driverLicenceNo],
                    ['Attendant', `${v.attendantName} · ${v.attendantPhone}`],
                  ].map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="shrink-0 text-ink-3">{k}</dt>
                      <dd className="min-w-0 truncate text-right font-medium text-ink">{val}</dd>
                    </div>
                  ))}
                </dl>

                <ul className="space-y-1.5">
                  {papers.map(([label, expiry]) => {
                    const days = daysFromToday(expiry);
                    const lapsed = days < 0;
                    const soon = days >= 0 && days <= 45;
                    return (
                      <li
                        key={label}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12.5px]"
                      >
                        <span className="min-w-0 flex-1 text-ink-2">{label}</span>
                        <span className="text-ink-3 tnum">{formatDate(expiry)}</span>
                        {lapsed ? (
                          <Badge tone="critical">Expired {Math.abs(days)}d ago</Badge>
                        ) : soon ? (
                          <Badge tone="warning">{days}d left</Badge>
                        ) : (
                          <Badge tone="good">Current</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {canManage ? (
                  <Button size="sm" variant="secondary" onClick={() => setEditing(v.id)}>
                    Record a renewal
                  </Button>
                ) : null}
              </CardBody>
            </MotionCard>
          );
        })}
      </div>

      {vehicle ? (
        <RenewalDialog
          vehicleId={vehicle.id}
          busNo={vehicle.busNo}
          fcExpiry={vehicle.fcExpiry}
          insuranceExpiry={vehicle.insuranceExpiry}
          permitExpiry={vehicle.permitExpiry}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function RenewalDialog({
  vehicleId,
  busNo,
  fcExpiry,
  insuranceExpiry,
  permitExpiry,
  onClose,
}: {
  vehicleId: string;
  busNo: string;
  fcExpiry: string;
  insuranceExpiry: string;
  permitExpiry: string;
  onClose: () => void;
}) {
  const [fc, setFc] = useState(fcExpiry);
  const [ins, setIns] = useState(insuranceExpiry);
  const [permit, setPermit] = useState(permitExpiry);

  return (
    <Modal
      open
      onClose={onClose}
      title={`${busNo} — renewals`}
      description="Record the new expiry date once a paper has been renewed."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              updateVehiclePapers({
                vehicleId,
                fcExpiry: fc,
                insuranceExpiry: ins,
                permitExpiry: permit,
              });
              toast.success(`${busNo} papers updated`);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Fitness certificate expires" htmlFor="vfc">
          <Input id="vfc" type="date" value={fc} onChange={(e) => setFc(e.target.value)} />
        </Field>
        <Field label="Insurance expires" htmlFor="vin">
          <Input id="vin" type="date" value={ins} onChange={(e) => setIns(e.target.value)} />
        </Field>
        <Field label="Permit expires" htmlFor="vpm">
          <Input id="vpm" type="date" value={permit} onChange={(e) => setPermit(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ── a parent asking for a seat ──────────────────────────────────────── */

function RequestTransport({ student }: { student: User }) {
  const db = useDatabase();
  const existing = db.studentTransport.find((t) => t.studentId === student.id);
  const [routeId, setRouteId] = useState(db.routes[0]?.id ?? '');
  const [stop, setStop] = useState('');
  const route = db.routes.find((r) => r.id === routeId);

  // A request already in the queue: show where it stands, not another form.
  if (existing && existing.status !== 'rejected') {
    const theirRoute = db.routes.find((r) => r.id === existing.routeId);
    return (
      <>
        <PageHeader
          title="Transport"
          subtitle={`${student.name} · ${classLabel(db, student.classId)}`}
        />
        <MotionCard delay={0.1}>
          <CardHeader title="Your request" subtitle="The school office will confirm a seat" />
          <CardBody className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3">
              <Bus className="size-4 shrink-0 text-ink-3" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">
                  {theirRoute?.name ?? 'Route'}
                </span>
                <span className="block text-[12px] text-ink-3">
                  Boarding at {existing.stop} · asked {formatDate(existing.requestedOn)}
                </span>
              </span>
              <Badge tone={existing.status === 'approved' ? 'info' : 'warning'}>
                {existing.status === 'approved' ? 'Approved — seat being allotted' : 'With the office'}
              </Badge>
            </div>
            <p className="text-[12.5px] leading-relaxed text-ink-3">
              You will be notified as soon as a seat is allotted, and the bus fee will be added to
              your fee account at that point — not before.
            </p>
          </CardBody>
        </MotionCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Transport"
        subtitle={`${student.name} · ${classLabel(db, student.classId)}`}
      />
      <MotionCard delay={0.1}>
        <CardHeader
          title="Request school transport"
          subtitle="Pick the route and the stop nearest your home"
        />
        <CardBody className="space-y-4 pt-4">
          <Field label="Route" htmlFor="rr">
            <Select
              id="rr"
              value={routeId}
              onChange={(e) => {
                setRouteId(e.target.value);
                setStop('');
              }}
            >
              {db.routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {money(r.fee)} a year
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Boarding point" htmlFor="rs">
            <Select id="rs" value={stop} onChange={(e) => setStop(e.target.value)}>
              <option value="">Choose a stop…</option>
              {route?.stops.map((st) => (
                <option key={st.name} value={st.name}>
                  {st.name} · {formatTime(st.time)}
                </option>
              ))}
            </Select>
          </Field>

          <Button
            disabled={!stop}
            onClick={() => {
              requestTransport(student.id, routeId, stop);
              toast.success('Request sent to the school office', {
                description: 'You will be notified once a seat is allotted.',
              });
            }}
          >
            Send request
          </Button>

          <p className="text-[12.5px] leading-relaxed text-ink-3">
            The fee shown is for the year and is billed across three terms. Nothing is charged until
            the office allots a seat.
          </p>
        </CardBody>
      </MotionCard>
    </>
  );
}

export default function Transport() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const can = useCan();
  const db0 = useDatabase();

  if (can('transport.manage') || (!user.roles.includes('parent') && !user.roles.includes('student'))) {
    return <AllRoutes />;
  }
  if (!subject) {
    return (
      <EmptyState icon={<Bus className="size-6" />} title="No student linked to this account" />
    );
  }
  // Without an allotted seat, the useful screen is the request form.
  const link = db0.studentTransport.find((t) => t.studentId === subject.id);
  if (!link || link.status !== 'allotted') {
    return can('transport.request') ? (
      <RequestTransport student={subject} />
    ) : (
      <EmptyState
        icon={<Bus className="size-6" />}
        title="Not using school transport"
        description="Contact the school office to ask for a seat on a bus route."
      />
    );
  }
  return <ChildTransport student={subject} />;
}
