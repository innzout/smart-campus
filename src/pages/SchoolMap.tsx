import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Building2,
  Clock,
  Dumbbell,
  FlaskConical,
  MapPin,
  Search,
  UtensilsCrossed,
} from 'lucide-react';
import { useDatabase } from '@/lib/store';
import { theCollege } from '@/lib/queries';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import type { CampusPlace } from '@/data/types';

const KIND: Record<
  CampusPlace['kind'],
  { tone: Tone; label: string; fill: string; icon: typeof Building2 }
> = {
  academic: { tone: 'info', label: 'Academic', fill: 'var(--s1)', icon: Building2 },
  amenity: { tone: 'warning', label: 'Amenity', fill: 'var(--s4)', icon: UtensilsCrossed },
  sports: { tone: 'good', label: 'Sports', fill: 'var(--s3)', icon: Dumbbell },
  admin: { tone: 'brand', label: 'Office', fill: 'var(--s7)', icon: MapPin },
  lab: { tone: 'info', label: 'Laboratory', fill: 'var(--s2)', icon: FlaskConical },
  hostel: { tone: 'serious', label: 'Hostel', fill: 'var(--s5)', icon: Building2 },
};

export default function SchoolMap() {
  const db = useDatabase();
  const school = theCollege(db);
  const [selected, setSelected] = useState<string | null>(db.places[0]?.id ?? null);
  const [query, setQuery] = useState('');

  const places = db.places.filter((p) =>
    !query.trim() ? true : p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const active = db.places.find((p) => p.id === selected) ?? null;

  return (
    <>
      <PageHeader title="School Map" subtitle={`${school.name} · ${school.address}`} />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <MotionCard>
          <CardHeader
            title="Site plan"
            subtitle="Tap any block for details"
            action={
              <div className="flex flex-wrap gap-2">
                {Object.entries(KIND).map(([key, cfg]) => (
                  <span key={key} className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
                    <span className="size-2.5 rounded-[3px]" style={{ background: cfg.fill }} aria-hidden />
                    {cfg.label}
                  </span>
                ))}
              </div>
            }
          />
          <CardBody className="pt-4">
            {/* Percentage-positioned blocks on a fixed-aspect plot, so the map scales. */}
            <div
              className="relative w-full overflow-hidden rounded-2xl border border-line"
              style={{
                aspectRatio: '4 / 3',
                backgroundColor: 'var(--surface-2)',
                backgroundImage:
                  'linear-gradient(90deg, var(--grid-line) 1px, transparent 1px), linear-gradient(var(--grid-line) 1px, transparent 1px)',
                backgroundSize: '6% 8%',
              }}
            >
              <span className="absolute top-0 bottom-0 left-[29%] w-[2.5%] bg-line/60" aria-hidden />
              <span className="absolute top-[52%] right-0 left-0 h-[3%] bg-line/60" aria-hidden />

              {db.places.map((place, i) => {
                const cfg = KIND[place.kind];
                const isActive = place.id === selected;
                const Icon = cfg.icon;
                return (
                  <motion.button
                    key={place.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.34, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => setSelected(place.id)}
                    aria-label={place.name}
                    aria-pressed={isActive}
                    className={cn(
                      'absolute flex flex-col justify-center gap-1 rounded-xl border-2 p-2 text-left transition-all',
                      isActive
                        ? 'z-10 scale-[1.04] border-brand-500 bg-surface shadow-pop'
                        : 'border-line-strong bg-surface shadow-card hover:border-brand-500/50',
                    )}
                    style={{
                      left: `${place.x}%`,
                      top: `${place.y}%`,
                      width: `${place.w}%`,
                      height: `${place.h}%`,
                    }}
                  >
                    <span
                      className="grid size-5 shrink-0 place-items-center rounded-md"
                      style={{ background: cfg.fill }}
                    >
                      <Icon className="size-3 text-white" aria-hidden />
                    </span>
                    <span className="line-clamp-2 text-[11px] leading-tight font-semibold text-ink">
                      {place.name}
                    </span>
                  </motion.button>
                );
              })}

              <span className="absolute bottom-2.5 left-3 rounded-md bg-surface/85 px-2 py-1 text-[10px] font-medium text-ink-3 backdrop-blur-sm">
                Main gate — south side
              </span>
            </div>
          </CardBody>
        </MotionCard>

        <div className="space-y-5">
          {active ? (
            <MotionCard delay={0.1}>
              <CardHeader
                title={active.name}
                subtitle={KIND[active.kind].label}
                action={<Badge tone={KIND[active.kind].tone}>{KIND[active.kind].label}</Badge>}
              />
              <CardBody className="pt-4">
                <p className="text-[13px] leading-relaxed text-ink-2">{active.detail}</p>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-3">
                  <Clock className="size-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="text-[12.5px] text-ink-2">
                    Open <span className="font-semibold text-ink">{active.open}</span>
                  </span>
                </div>
              </CardBody>
            </MotionCard>
          ) : null}

          <MotionCard delay={0.16}>
            <CardHeader
              title="All locations"
              subtitle={`${places.length} of ${db.places.length}`}
              action={
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a block…"
                  aria-label="Search locations"
                  leading={<Search className="size-4" />}
                  className="h-9 w-full text-[13px] sm:w-44"
                />
              }
            />
            <CardBody className="pt-3">
              {places.length === 0 ? (
                <EmptyState
                  icon={<MapPin className="size-6" />}
                  title="No match"
                  description={`Nothing is called “${query}”.`}
                />
              ) : (
                <ul className="space-y-1">
                  {places.map((place) => {
                    const cfg = KIND[place.kind];
                    const isActive = place.id === selected;
                    return (
                      <li key={place.id}>
                        <button
                          onClick={() => setSelected(place.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                            isActive ? 'bg-brand-500/10' : 'hover:bg-surface-hover',
                          )}
                        >
                          <span
                            className="size-2.5 shrink-0 rounded-[3px]"
                            style={{ background: cfg.fill }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">
                              {place.name}
                            </span>
                            <span className="block truncate text-[11.5px] text-ink-3">{place.open}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </MotionCard>
        </div>
      </div>
    </>
  );
}
