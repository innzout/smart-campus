import { useEffect, useState } from 'react';

/**
 * The app runs on the real wall clock. The bundled JSON seed, however, was
 * authored around a fixed calendar date — so when the database is first seeded
 * we shift every date in it by the number of days between that anchor and
 * today. The data then reads correctly ("due tomorrow", "2 days ago") whenever
 * the app is first opened, and time passes naturally from there.
 */
export const SEED_ANCHOR = '2026-09-24';

/** Local midnight for a `YYYY-MM-DD` string. */
export const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export const parseISODate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};

/** Whole days between two `YYYY-MM-DD` dates (b − a). */
export function daysBetween(aISO: string, bISO: string) {
  return Math.round((startOfDay(parseISODate(bISO)) - startOfDay(parseISODate(aISO))) / 86_400_000);
}

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Local-time ISO timestamp (no timezone suffix) — matches the seed format. */
export const toISODateTime = (d: Date) =>
  `${toISODate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

/** Shift a `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss` value by whole days. */
export function shiftDate(value: string, days: number): string {
  const hasTime = value.length > 10;
  const d = parseISODate(value);
  d.setDate(d.getDate() + days);
  return hasTime ? `${toISODate(d)}${value.slice(10)}` : toISODate(d);
}

/** Shift a `YYYY-MM` bucket by whole months. */
export function shiftMonth(value: string, months: number): string {
  const [y, m] = value.split('-').map(Number);
  const d = new Date(y!, m! - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Re-render on an interval so time-derived UI (the greeting, the "happening
 * now" class) stays correct without a reload. Defaults to once a minute.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Greeting and the day's label, derived from the real clock.
 *
 * A dashboard that says "Good morning" at nine in the evening undermines
 * everything else on the page, so this follows the actual time rather than a
 * value baked in at build.
 */
export function useClock() {
  const now = useNow();
  const hour = now.getHours();
  return {
    now,
    greeting: hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening',
    todayLabel: now.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    dayIndex: now.getDay(),
  };
}
