import { useSyncExternalStore } from 'react';
import { seedDatabase } from '@/data/seed';
import { scopeDatabase } from './scope';
import type { CollectionName, Database } from '@/data/types';

/**
 * The database of record is the bundled JSON seed; this module keeps a live
 * copy in memory and persists changes so a demo survives a reload.
 *
 * Storage is IndexedDB rather than localStorage. The full school — twelve
 * grades, 436 pupils, a term of attendance — serialises to roughly 4 MB, which
 * is past the 5 MB localStorage quota once it is counted as UTF-16. Writes
 * there failed silently, so anything done during a presentation was lost on
 * reload. IndexedDB has no practical ceiling at this size.
 *
 * Everything React touches stays synchronous: the store seeds itself on import
 * and `hydrate()` swaps in the saved copy before the app renders.
 */

const DB_NAME = 'scc';
const STORE = 'state';
const KEY = 'db';
// Bumped when the seed's shape changes, so a saved copy from an older build is
// replaced rather than silently kept.
const VERSION = '3';

interface Saved {
  version: string;
  db: Database;
}

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read(): Promise<Saved | null> {
  const idb = await openStore();
  try {
    return await new Promise<Saved | null>((resolve, reject) => {
      const request = idb.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve((request.result as Saved | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    idb.close();
  }
}

async function write(db: Database): Promise<void> {
  const idb = await openStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ version: VERSION, db } satisfies Saved, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    idb.close();
  }
}

let state: Database = seedDatabase();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/**
 * Writes are coalesced — saving four megabytes on every keystroke of a marks
 * entry form would make the page stutter.
 */
let pending: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(pending);
  const snapshotToSave = state;
  pending = setTimeout(() => {
    void write(snapshotToSave).catch(() => {
      /* Private mode or a blocked store — the in-memory copy still works. */
    });
  }, 400);
}

/**
 * Load the saved copy, if there is one, before the app renders. Resolves even
 * when storage is unavailable, in which case the seeded copy is used.
 */
export async function hydrate(): Promise<void> {
  // An earlier build kept the database in localStorage, where it no longer
  // fits. Clear it so the quota is not held by a copy nothing reads.
  try {
    localStorage.removeItem('scc.db');
    localStorage.removeItem('scc.db.version');
  } catch {
    /* ignore */
  }

  try {
    const saved = await read();
    if (saved?.version === VERSION && Array.isArray(saved.db.users) && saved.db.users.length) {
      state = saved.db;
      emit();
    } else if (saved) {
      // A copy from an older shape — replace it with the current seed.
      await write(state);
    }
  } catch {
    /* No storage available; carry on with the seeded copy. */
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => state;

/* ── the active branch ─────────────────────────────────────────────────── */

const BRANCH_KEY = 'scc.branch';

/**
 * Which school the app is currently looking at. Most people only ever have one,
 * and are pinned to it when they sign in; the trust's own account can move
 * between them.
 */
let activeSchoolId: string =
  (() => {
    try {
      return localStorage.getItem(BRANCH_KEY) ?? '';
    } catch {
      return '';
    }
  })() || (state.schools.find((s) => s.isMain) ?? state.schools[0])!.id;

export function setActiveBranch(schoolId: string) {
  if (schoolId === activeSchoolId) return;
  if (!state.schools.some((s) => s.id === schoolId)) return;
  activeSchoolId = schoolId;
  try {
    localStorage.setItem(BRANCH_KEY, schoolId);
  } catch {
    /* private mode — the choice lasts for this session only */
  }
  emit();
}

export const getActiveBranch = () => activeSchoolId;

/** Read the active branch id, re-rendering when it changes. */
export function useActiveBranch(): string {
  return useSyncExternalStore(subscribe, getActiveBranch, getActiveBranch);
}

/**
 * The snapshot filtered to the active branch.
 *
 * Filtering ~28,000 rows is not free, so the result is cached against the
 * snapshot's identity and the branch id. It is recomputed once after a mutation
 * or a branch change, not on every render.
 */
let scopedFor: { state: Database; schoolId: string; result: Database } | null = null;

function scopedSnapshot(): Database {
  if (scopedFor && scopedFor.state === state && scopedFor.schoolId === activeSchoolId) {
    return scopedFor.result;
  }
  const result = scopeDatabase(state, activeSchoolId);
  scopedFor = { state, schoolId: activeSchoolId, result };
  return result;
}

/**
 * Apply a change to the database.
 *
 * The draft is a new root object holding new arrays of the *same* row objects.
 * That gives React the fresh identities it needs to re-render — both at the
 * root and at any collection a recipe replaces — without copying 35,000 rows
 * on every keystroke. A deep clone measured 94ms per mutation, which is a
 * visible stall when saving a register; this is about a millisecond.
 *
 * The trade-off is that a recipe editing a row in place also edits the row the
 * previous snapshot pointed at. Nothing here keeps an old snapshot — there is
 * no undo built on it and nothing memoises on a row's identity — so it holds.
 * Were time travel ever wanted, this is the line that would have to change.
 */
export function mutate(recipe: (draft: Database) => void) {
  const draft = { ...state };
  for (const key of Object.keys(draft) as CollectionName[]) {
    const value = draft[key];
    if (Array.isArray(value)) {
      // Each collection is a fresh array of the same rows.
      (draft[key] as unknown[]) = [...value];
    }
  }
  recipe(draft);
  state = draft;
  persist();
  emit();
}

/** Reset every collection back to the JSON seed files. */
export function resetDatabase() {
  state = seedDatabase();
  persist();
  emit();
}

/**
 * Read the database, re-rendering on any mutation or branch change.
 *
 * What comes back is scoped to the active branch, so a page never has to think
 * about which school it is looking at.
 */
export function useDatabase(): Database {
  return useSyncExternalStore(subscribe, scopedSnapshot, scopedSnapshot);
}

/** The unscoped snapshot, for the few places that must see every branch. */
export function useWholeDatabase(): Database {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Read a derived slice. `select` must be cheap and should return a stable value
 * for unchanged input — it runs on every render and on every store change.
 */
export function useSelector<T>(select: (db: Database) => T): T {
  return select(useSyncExternalStore(subscribe, scopedSnapshot, scopedSnapshot));
}

/**
 * Read the database outside of React (event handlers, validators).
 *
 * This is the unscoped copy: mutations write across the whole trust, and an
 * action that has just been handed an id does not need it filtered.
 */
export const getDatabase = () => state;

/** The active branch's slice, outside of React. */
export const getScopedDatabase = () => scopedSnapshot();

/** Monotonic-enough id generator for records created in the browser. */
export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
