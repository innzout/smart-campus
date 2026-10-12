import { useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, Clock, MapPin, PartyPopper, Users } from 'lucide-react';
import { useDatabase } from '@/lib/store';
import { StatGrid, StatTile } from '@/components/StatTile';
import { MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { cn, daysFromToday, formatDate, formatTime, relativeDay, todayISO } from '@/lib/utils';
import type { CollegeEvent } from '@/data/types';

const CATEGORY_TONE: Record<CollegeEvent['category'], Tone> = {
  Cultural: 'brand',
  Sports: 'warning',
  Academic: 'info',
  Seminar: 'good',
  Placement: 'serious',
  Holiday: 'neutral',
};

const GRADIENTS: Record<CollegeEvent['category'], string> = {
  Cultural: 'from-[#6963f1] to-[#a855f7]',
  Sports: 'from-[#eda100] to-[#eb6834]',
  Academic: 'from-[#2a78d6] to-[#22d3ee]',
  Seminar: 'from-[#1baf7a] to-[#34d399]',
  Placement: 'from-[#ec4899] to-[#f43f5e]',
  Holiday: 'from-[#64748b] to-[#94a3b8]',
};

export default function Events() {
  const db = useDatabase();
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming');
  const [detail, setDetail] = useState<CollegeEvent | null>(null);

  const all = [...db.events].sort((a, b) => a.date.localeCompare(b.date));
  const list = all.filter((e) => (filter === 'upcoming' ? e.date >= todayISO() : true));
  const next = all.find((e) => e.date >= todayISO());

  return (
    <>
      <PageHeader
        title="School Events"
        subtitle="Celebrations, meetings and activities through the year."
        action={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'upcoming', label: `Upcoming (${all.filter((e) => e.date >= todayISO()).length})` },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />

      <StatGrid>
        <StatTile label="Upcoming" value={all.filter((e) => e.date >= todayISO()).length} note="Through the term" icon={CalendarDays} />
        <StatTile label="Next event" value={next ? formatDate(next.date, { year: undefined }) : '—'} note={next?.title ?? 'Nothing scheduled'} icon={Clock} tone={next ? 'good' : 'neutral'} delay={0.06} />
        <StatTile label="This month" value={all.filter((e) => e.date.slice(0, 7) === todayISO().slice(0, 7)).length} note="On the calendar" icon={PartyPopper} delay={0.12} />
        <StatTile label="Parent meetings" value={all.filter((e) => e.category === 'Academic').length} note="PTM this year" icon={Users} delay={0.18} />
      </StatGrid>

      {list.length === 0 ? (
        <MotionCard>
          <EmptyState icon={<PartyPopper className="size-6" />} title="No events to show" />
        </MotionCard>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((event, i) => {
            const past = daysFromToday(event.date) < 0;
            return (
              <motion.li
                key={event.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.36, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop',
                  past && 'opacity-70',
                )}
              >
                <div className={cn('relative flex h-32 items-end bg-gradient-to-br p-4', GRADIENTS[event.category])}>
                  <span className="absolute top-3.5 right-3.5 rounded-lg bg-white/20 px-2 py-1 text-[10.5px] font-bold tracking-wide text-white uppercase backdrop-blur-sm">
                    {event.category}
                  </span>
                  <div className="text-white">
                    <p className="text-[26px] leading-none font-semibold">{event.date.slice(8)}</p>
                    <p className="mt-1 text-[11.5px] font-medium tracking-wide uppercase opacity-90">
                      {new Date(`${event.date}T00:00:00`).toLocaleDateString('en-IN', { month: 'long' })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-[15px] leading-snug font-semibold text-ink">{event.title}</h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-[12.5px] leading-relaxed text-ink-2">
                    {event.description}
                  </p>

                  <dl className="mt-3.5 space-y-1.5 text-[12px] text-ink-3">
                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5 shrink-0" aria-hidden />
                      <span>{formatTime(event.time)} · {relativeDay(event.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{event.venue}</span>
                    </div>
                  </dl>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Badge tone={CATEGORY_TONE[event.category]}>{past ? 'Completed' : relativeDay(event.date)}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => setDetail(event)}>Details</Button>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {detail ? (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={detail.title}
          description={`${detail.category} · organised by ${detail.organiser}`}
          footer={<Button onClick={() => setDetail(null)}>Close</Button>}
        >
          <p className="text-[13.5px] leading-relaxed text-ink-2">{detail.description}</p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ['Date', formatDate(detail.date)],
              ['Time', formatTime(detail.time)],
              ['Venue', detail.venue],
              ['Open to', detail.forSections === 'all' ? 'All classes' : (detail.forSections as string[]).join(', ')],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-2 px-3.5 py-3">
                <dt className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{label}</dt>
                <dd className="mt-1 text-[13.5px] font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      ) : null}
    </>
  );
}
