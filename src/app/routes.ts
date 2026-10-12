import { lazy } from 'react';

/**
 * Route modules, defined once so they can be both lazily rendered and eagerly
 * prefetched — a cold chunk fetched on click is a visible stall mid-demo.
 */
const loaders = {
  '/': () => import('@/pages/Dashboard'),
  '/attendance': () => import('@/pages/Attendance'),
  '/assignments': () => import('@/pages/Assignments'),
  '/results': () => import('@/pages/Results'),
  '/fees': () => import('@/pages/Fees'),
  '/timetable': () => import('@/pages/Timetable'),
  '/circulars': () => import('@/pages/Circulars'),
  '/meetings': () => import('@/pages/Meetings'),
  '/visits': () => import('@/pages/Visits'),
  '/events': () => import('@/pages/Events'),
  '/transport': () => import('@/pages/Transport'),
  '/library': () => import('@/pages/Library'),
  '/requests': () => import('@/pages/Requests'),
  '/campus': () => import('@/pages/SchoolMap'),
  '/notifications': () => import('@/pages/Notifications'),
  '/students': () => import('@/pages/People'),
  '/academics': () => import('@/pages/Academics'),
  '/recruitment': () => import('@/pages/Recruitment'),
  '/substitutions': () => import('@/pages/Substitutions'),
  '/labs': () => import('@/pages/Labs'),
  '/payroll': () => import('@/pages/Payroll'),
  '/roles': () => import('@/pages/Roles'),
  '/branches': () => import('@/pages/Branches'),
  '/placements': () => import('@/pages/Placements'),
  '/hostel': () => import('@/pages/Hostel'),
  '/mentoring': () => import('@/pages/Mentoring'),
  '/settings': () => import('@/pages/Settings'),
} as const;

export type RoutePath = keyof typeof loaders;

const started = new Map<string, Promise<unknown>>();

export function prefetchRoute(path: string) {
  const load = loaders[path as RoutePath];
  if (!load) return;
  let promise = started.get(path);
  if (!promise) {
    promise = load().catch(() => started.delete(path));
    started.set(path, promise);
  }
  return promise;
}

/**
 * Warm the reachable routes once the browser is idle — one at a time, so the
 * route actually being opened never queues behind the rest.
 */
export function prefetchAll(paths: string[]) {
  const queue = paths.filter((p) => p in loaders && !started.has(p));
  const idle = (fn: () => void) =>
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback(fn, { timeout: 3000 })
      : setTimeout(fn, 200);

  const step = () => {
    const next = queue.shift();
    if (!next) return;
    void Promise.resolve(prefetchRoute(next)).then(() => idle(step));
  };
  idle(step);
}

export const Dashboard = lazy(loaders['/']);
export const Attendance = lazy(loaders['/attendance']);
export const Assignments = lazy(loaders['/assignments']);
export const Results = lazy(loaders['/results']);
export const Fees = lazy(loaders['/fees']);
export const Timetable = lazy(loaders['/timetable']);
export const Circulars = lazy(loaders['/circulars']);
export const Meetings = lazy(loaders['/meetings']);
export const Visits = lazy(loaders['/visits']);
export const Events = lazy(loaders['/events']);
export const Transport = lazy(loaders['/transport']);
export const Library = lazy(loaders['/library']);
export const Requests = lazy(loaders['/requests']);
export const SchoolMap = lazy(loaders['/campus']);
export const Notifications = lazy(loaders['/notifications']);
export const People = lazy(loaders['/students']);
export const Academics = lazy(loaders['/academics']);
export const Recruitment = lazy(loaders['/recruitment']);
export const Substitutions = lazy(loaders['/substitutions']);
export const Labs = lazy(loaders['/labs']);
export const Payroll = lazy(loaders['/payroll']);
export const Roles = lazy(loaders['/roles']);
export const Branches = lazy(loaders['/branches']);
export const Placements = lazy(loaders['/placements']);
export const Hostel = lazy(loaders['/hostel']);
export const Mentoring = lazy(loaders['/mentoring']);
export const Settings = lazy(loaders['/settings']);

export const Login = lazy(() => import('@/pages/Login'));
export const NotFound = lazy(() => import('@/pages/NotFound'));
