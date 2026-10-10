import { useSyncExternalStore } from 'react';
import { seedDatabase } from '@/data/seed';
import type { Database } from '@/data/types';

const KEY = 'scc.db';
const VERSION_KEY = 'scc.db.version';
// Bumped when the seed's shape or date handling changes, so an existing
// localStorage copy is replaced rather than silently kept.
const VERSION = '2';

function load(): Database {
  try {
    if (localStorage.getItem(VERSION_KEY) !== VERSION) throw new Error('stale');
    const raw = localStorage.getItem(KEY);
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as Database;
    // Guard against a partially-written or hand-edited payload.
    if (!Array.isArray(parsed.users) || parsed.users.length === 0) throw new Error('invalid');
    return parsed;
  } catch {
    const fresh = seedDatabase();
    persist(fresh);
    return fresh;
  }
}

function persist(db: Database) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    localStorage.setItem(VERSION_KEY, VERSION);
  } catch {
    /* Quota or private mode — the in-memory copy still works for this session. */
  }
}

let state: Database = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => state;

/**
 * Apply a change to the database. The recipe receives a shallow-cloned draft
 * whose collections are fresh arrays, so replacing one collection never mutates
 * the previous snapshot React is still holding.
 */
export function mutate(recipe: (draft: Database) => void) {
  const draft = structuredClone(state);
  recipe(draft);
  state = draft;
  persist(state);
  emit();
}

/** Reset every collection back to the JSON seed files. */
export function resetDatabase() {
  state = seedDatabase();
  persist(state);
  emit();
}

/** Read the whole database, re-rendering on any mutation. */
export function useDatabase(): Database {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Read a derived slice. `select` must be cheap and should return a stable value
 * for unchanged input — it runs on every render and on every store change.
 */
export function useSelector<T>(select: (db: Database) => T): T {
  return select(useSyncExternalStore(subscribe, snapshot, snapshot));
}

/** Read the database outside of React (event handlers, validators). */
export const getDatabase = () => state;

/** Monotonic-enough id generator for records created in the browser. */
export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
