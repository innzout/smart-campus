import { useState } from 'react';
import { Bus, Clock, MapPin, Phone, Users } from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { classLabel, routeRiders, transportFor } from '@/lib/queries';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Avatar, EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { BarList } from '@/components/charts/Charts';
import { cn, formatTime, money, num } from '@/lib/utils';
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
            <span className="tnum w-12 shrink-0 pt-0.5 text-right text-[11.5px] font-medium text-ink-3">
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

  const { route, stop, pickup } = link;

  return (
    <>
      <PageHeader
        title="Transport"
        subtitle={`${student.name} · ${classLabel(db, student.classId)} · ${route.name}`}
      />

      <StatGrid>
        <StatTile label="Pickup time" value={pickup ? formatTime(pickup.time) : '—'} note={stop} icon={Clock} tone="good" />
        <StatTile label="Bus number" value={route.busNo} note={route.name} icon={Bus} delay={0.06} />
        <StatTile label="Driver" value={route.driverName} note={route.driverPhone} icon={Phone} delay={0.12} />
        <StatTile label="Annual bus fee" value={money(route.fee)} note="Billed across three terms" icon={MapPin} delay={0.18} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <MotionCard delay={0.1}>
          <CardHeader title="Route and stops" subtitle={`${route.name} · ${route.busNo}`} />
          <CardBody className="pt-4">
            <RouteStops routeId={route.id} highlight={stop} />
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader title="Driver and bus" subtitle="Who to call if the bus is late" />
          <CardBody className="space-y-3 pt-4">
            <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
              <Avatar name={route.driverName} hue={30} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{route.driverName}</span>
                <span className="block text-[12px] text-ink-3">Driver · {route.busNo}</span>
              </span>
              <a
                href={`tel:${route.driverPhone.replace(/\s/g, '')}`}
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
    meta: `${r.name} · ${r.busNo}`,
  }));

  const totalRiders = db.studentTransport.length;

  return (
    <>
      <PageHeader
        title="Transport"
        subtitle={`${db.routes.length} routes · ${num(totalRiders)} students use the school bus`}
        action={
          <Segmented
            size="sm"
            value={routeId}
            onChange={setRouteId}
            options={db.routes.map((r) => ({ value: r.id, label: r.name.replace(/^Route (\d+).*/, 'R$1') }))}
          />
        }
      />

      <StatGrid>
        <StatTile label="Routes" value={db.routes.length} note="Operating daily" icon={Bus} />
        <StatTile label="Students on bus" value={num(totalRiders)} note={`${Math.round((totalRiders / db.users.filter((u) => u.role === 'student').length) * 100)}% of the school`} icon={Users} delay={0.06} />
        <StatTile label="On this route" value={riders.length} note={route?.name ?? '—'} icon={MapPin} delay={0.12} />
        <StatTile label="Annual fee" value={route ? money(route.fee) : '—'} note="Per student, this route" icon={Clock} delay={0.18} />
      </StatGrid>

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
            subtitle={route ? `${route.busNo} · ${route.driverName} · ${route.driverPhone}` : ''}
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
  );
}

export default function Transport() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const can = useCan();

  if (can('transport.manage') || (user.role !== 'parent' && user.role !== 'student')) {
    return <AllRoutes />;
  }
  if (!subject) return <EmptyState icon={<Bus className="size-6" />} title="No student linked to this account" />;
  return <ChildTransport student={subject} />;
}
