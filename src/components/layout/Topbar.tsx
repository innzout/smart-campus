import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, Menu, Monitor, Moon, Search, Sun } from 'lucide-react';
import { NAV } from '@/app/nav';
import { useTheme, type ThemePref } from '@/app/theme';
import { useSelector } from '@/lib/store';
import { notificationsFor, unreadCount } from '@/lib/queries';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions';
import { Avatar, Segmented } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { cn, relativeTime } from '@/lib/utils';
import type { AuthUser } from '@/services/auth.service';

function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  return (
    <Segmented<ThemePref>
      size="sm"
      value={preference}
      onChange={setPreference}
      options={[
        { value: 'light', label: <Sun className="size-3.5" aria-label="Light" /> },
        { value: 'dark', label: <Moon className="size-3.5" aria-label="Dark" /> },
        { value: 'system', label: <Monitor className="size-3.5" aria-label="System" /> },
      ]}
      className="hidden sm:inline-flex"
    />
  );
}

function NotificationBell({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const items = useSelector((db) => notificationsFor(db, user.id));
  const unread = useSelector((db) => unreadCount(db, user.id));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
      >
        <Bell className="size-[19px]" />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 grid min-w-[17px] place-items-center rounded-full bg-[--color-critical] px-1 text-[9.5px] font-bold text-white ring-2 ring-surface">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
            >
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="text-[13.5px] font-semibold text-ink">Notifications</p>
                {unread > 0 ? (
                  <button
                    onClick={() => markAllNotificationsRead(user.id)}
                    className="text-[12px] font-medium text-brand-600 hover:underline dark:text-brand-300"
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>

              <ul className="max-h-[22rem] divide-y divide-line overflow-y-auto">
                {items.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <Link
                      to={n.link ?? '/notifications'}
                      onClick={() => {
                        markNotificationRead(n.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'block px-4 py-3 transition-colors hover:bg-surface-hover',
                        !n.read && 'bg-brand-500/[0.06]',
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {!n.read ? (
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                        ) : (
                          <span className="mt-1.5 size-1.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-ink">{n.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-3">{n.body}</p>
                          <p className="mt-1 text-[11px] text-ink-3">{relativeTime(n.createdOn)}</p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
                {items.length === 0 ? (
                  <li className="px-4 py-10 text-center text-[13px] text-ink-3">
                    You’re all caught up.
                  </li>
                ) : null}
              </ul>

              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="block border-t border-line bg-surface-2 px-4 py-2.5 text-center text-[12.5px] font-medium text-brand-600 hover:underline dark:text-brand-300"
              >
                View all notifications
              </Link>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Topbar({
  user,
  onOpenNav,
  onOpenSearch,
}: {
  user: AuthUser;
  onOpenNav: () => void;
  onOpenSearch: () => void;
}) {
  const { pathname } = useLocation();
  const current = NAV.find((n) => n.to === pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1560px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="lg:hidden"
        >
          <Menu className="size-5" />
        </Button>

        <p className="hidden truncate text-[15px] font-semibold text-ink lg:block">
          {current?.label ?? 'Dashboard'}
        </p>

        {/* The search button opens the command palette rather than being a live input. */}
        <button
          onClick={onOpenSearch}
          className="ml-auto flex h-10 items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 lg:w-72"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden text-[13px] lg:block">Search school…</span>
          <kbd className="ml-auto hidden rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium lg:block">
            Ctrl K
          </kbd>
        </button>

        <ThemeSwitch />
        <NotificationBell user={user} />

        <Link
          to="/settings"
          className="flex items-center gap-2.5 rounded-xl py-1 pr-1 pl-1 transition-colors hover:bg-surface-hover"
        >
          <Avatar name={user.name} hue={user.avatarHue} size="sm" />
          <span className="hidden leading-tight sm:block">
            <span className="block max-w-[10rem] truncate text-[13px] font-semibold text-ink">
              {user.name}
            </span>
            <span className="block text-[11px] text-ink-3 capitalize">{user.role}</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
