import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CornerDownLeft, Search } from 'lucide-react';
import { navFor } from '@/app/nav';
import { useDatabase } from '@/lib/store';
import { primaryRole, roleName } from '@/services/auth.service';
import { cn } from '@/lib/utils';

interface Hit {
  id: string;
  label: string;
  hint: string;
  group: string;
  to: string;
}

export function CommandPalette({
  open,
  onClose,
  permissions,
}: {
  open: boolean;
  onClose: () => void;
  permissions: string[];
}) {
  const db = useDatabase();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      // Focus after the entrance animation has begun so it isn't stolen.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();

    const pages: Hit[] = navFor(permissions).map((item) => ({
      id: `page-${item.to}`,
      label: item.label,
      hint: 'Go to page',
      group: 'Pages',
      to: item.to,
    }));

    if (!q) return pages.slice(0, 8);

    const matches = (...fields: (string | undefined)[]) =>
      fields.some((f) => f?.toLowerCase().includes(q));

    const out: Hit[] = [];

    for (const item of navFor(permissions)) {
      if (matches(item.label, item.keywords)) {
        out.push({ id: `page-${item.to}`, label: item.label, hint: 'Go to page', group: 'Pages', to: item.to });
      }
    }

    for (const s of db.subjects) {
      if (matches(s.name, s.code)) {
        out.push({ id: `sub-${s.id}`, label: s.name, hint: `${s.code} · attendance`, group: 'Subjects', to: '/attendance' });
      }
    }

    for (const h of db.homework) {
      if (matches(h.title)) {
        out.push({ id: `hw-${h.id}`, label: h.title, hint: `Due ${h.dueOn}`, group: 'Homework', to: '/homework' });
      }
    }

    for (const c of db.circulars) {
      if (matches(c.title, c.category)) {
        out.push({ id: `cir-${c.id}`, label: c.title, hint: c.category, group: 'Circulars', to: '/circulars' });
      }
    }

    for (const e of db.events) {
      if (matches(e.title, e.category, e.venue)) {
        out.push({ id: `evt-${e.id}`, label: e.title, hint: `${e.date} · ${e.venue}`, group: 'Events', to: '/events' });
      }
    }

    for (const b of db.books) {
      if (matches(b.title, b.author, b.category)) {
        out.push({ id: `bok-${b.id}`, label: b.title, hint: b.author, group: 'Library', to: '/library' });
      }
    }

    for (const p of db.places) {
      if (matches(p.name)) {
        out.push({ id: `plc-${p.id}`, label: p.name, hint: `Open ${p.open}`, group: 'Campus', to: '/campus' });
      }
    }

    if (permissions.includes('user.view')) {
      for (const u of db.users) {
        if (matches(u.name, u.email, u.admissionNo, u.employeeId)) {
          out.push({ id: `usr-${u.id}`, label: u.name, hint: u.admissionNo ?? u.employeeId ?? roleName(primaryRole(u.roles)), group: 'People', to: '/students' });
        }
      }
    }

    return out.slice(0, 24);
  }, [query, db, permissions]);

  // Keep the cursor inside the result list as it shrinks.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, hits.length - 1)));
  }, [hits.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => (c + 1) % Math.max(1, hits.length));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => (c - 1 + hits.length) % Math.max(1, hits.length));
      }
      if (e.key === 'Enter' && hits[cursor]) {
        e.preventDefault();
        navigate(hits[cursor]!.to);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hits, cursor, navigate, onClose]);

  let lastGroup = '';

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#080a10]/50 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search the school"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students, circulars, homework, classes…"
                aria-label="Search"
                className="h-14 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
              />
              <kbd className="hidden shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-3 sm:block">
                ESC
              </kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {hits.length === 0 ? (
                <p className="px-3 py-10 text-center text-[13px] text-ink-3">
                  Nothing matches “{query}”.
                </p>
              ) : (
                <ul>
                  {hits.map((hit, i) => {
                    const showGroup = hit.group !== lastGroup;
                    lastGroup = hit.group;
                    return (
                      <li key={hit.id}>
                        {showGroup ? (
                          <p className="px-3 pt-3 pb-1 text-[10.5px] font-semibold tracking-wider text-ink-3 uppercase">
                            {hit.group}
                          </p>
                        ) : null}
                        <button
                          onMouseEnter={() => setCursor(i)}
                          onClick={() => {
                            navigate(hit.to);
                            onClose();
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                            i === cursor ? 'bg-brand-500/12' : 'hover:bg-surface-hover',
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium text-ink">
                              {hit.label}
                            </span>
                            <span className="block truncate text-[11.5px] text-ink-3">
                              {hit.hint}
                            </span>
                          </span>
                          {i === cursor ? (
                            <CornerDownLeft className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
