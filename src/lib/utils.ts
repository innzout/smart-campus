import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/**
 * The real clock. The seeded data is rebased onto today when the database is
 * first created (see `data/seed.ts`), so nothing here needs to be pinned.
 */
export const now = () => new Date();

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const money = (n: number) => inr.format(n);

/** Compact money for stat tiles: ₹12.5L, ₹1.2Cr. */
export function moneyCompact(n: number) {
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 1)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1)}L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1)}K`;
  return inr.format(n);
}

export const num = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export function compact(n: number) {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return num(n);
}

export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`;

export const parseDate = (iso: string) => new Date(`${iso}${iso.length === 10 ? 'T00:00:00' : ''}`);

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return parseDate(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
}

export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h! >= 12 ? 'PM' : 'AM';
  const hour = h! % 12 === 0 ? 12 : h! % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Whole days from today — negative means in the past. */
export function daysFromToday(iso: string) {
  const ms = parseDate(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

/** "in 3 days" / "2 days ago" / "today". */
export function relativeDay(iso: string) {
  const d = daysFromToday(iso);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${d} days` : `${Math.abs(d)} days ago`;
}

export function relativeTime(iso: string) {
  const mins = Math.round((Date.now() - parseDate(iso).getTime()) / 60_000);
  // A seeded timestamp can land slightly ahead of the clock on the day it is
  // rebased; read that as "just now" rather than showing a negative age.
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export const initials = (name: string) =>
  name
    .replace(/^(Dr|Prof)\.?\s+/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Teaching days are Mon=1 … Sat=6. Sunday (0) has no timetable. */
export const TEACHING_DAYS = [1, 2, 3, 4, 5, 6] as const;

/** The real weekday, 0 (Sunday) … 6 (Saturday). */
export const todayIndex = () => new Date().getDay();

export const isSunday = () => new Date().getDay() === 0;

/** Greeting that tracks the actual time of day. */
export function greetingFor(date: Date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

/** "Thursday, 24 September 2026" for the dashboard subtitle. */
export const longDate = (date: Date = new Date()) =>
  date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/** Local `YYYY-MM-DD` for today — never use toISOString(), which is UTC. */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Schools chase attendance below this, rather than gating exams on it. */
export const ATTENDANCE_THRESHOLD = 85;

export function sum<T>(rows: T[], get: (row: T) => number) {
  return rows.reduce((total, row) => total + get(row), 0);
}

export function groupBy<T, K extends string>(rows: T[], key: (row: T) => K) {
  const out = {} as Record<K, T[]>;
  for (const row of rows) (out[key(row)] ??= []).push(row);
  return out;
}

/** Title-case a slug or enum value for display: "in-progress" → "In progress". */
export function humanise(value: string) {
  const s = value.replace(/[-_]/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The school day, as a list of periods.
 *
 * Shared so that a class created in the app gets the same week-shape as one
 * that came from the seed — a timetable the scheduler can then fill in.
 */
export const SCHOOL_PERIODS: { start: string; end: string; kind: 'period' | 'break' | 'lunch' }[] = [
  { start: '09:00', end: '09:40', kind: 'period' },
  { start: '09:40', end: '10:20', kind: 'period' },
  { start: '10:20', end: '10:35', kind: 'break' },
  { start: '10:35', end: '11:15', kind: 'period' },
  { start: '11:15', end: '11:55', kind: 'period' },
  { start: '11:55', end: '12:35', kind: 'lunch' },
  { start: '12:35', end: '13:15', kind: 'period' },
  { start: '13:15', end: '13:55', kind: 'period' },
  { start: '13:55', end: '14:35', kind: 'period' },
];

/**
 * Whether a class sits for a given period on a given day. Saturday is a half
 * day for everyone, and the primary classes go home before the last two.
 */
export function classSitsFor(grade: number, day: number, index: number) {
  if (day === 6 && index > 4) return false;
  if (grade <= 5 && index > 6) return false;
  return true;
}
