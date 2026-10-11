import { useId } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { GraduationCap, LogOut, X } from 'lucide-react';
import { GROUP_ORDER, groupLabel, navFor } from '@/app/nav';
import { prefetchRoute } from '@/app/routes';
import { useAuth } from '@/app/auth';
import { useDatabase, useSelector } from '@/lib/store';
import { theSchool, unreadCount } from '@/lib/queries';
import { Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import type { AuthUser } from '@/services/auth.service';

function Brand({ onClose }: { onClose?: () => void }) {
  const school = theSchool(useDatabase());
  return (
    <div className="flex items-center gap-3 px-3 pt-1 pb-6">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <GraduationCap className="size-5" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-semibold text-ink">{school.shortName}</span>
        <span className="block truncate text-[11.5px] text-ink-3">{school.academicYear} · Term {school.currentTerm}</span>
      </span>
      {onClose ? (
        <button
          onClick={onClose}
          aria-label="Close navigation"
          className="ml-auto grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-hover hover:text-ink lg:hidden"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function SidebarContent({ user, onNavigate }: { user: AuthUser; onNavigate?: () => void }) {
  const { logout } = useAuth();
  const unread = useSelector((db) => unreadCount(db, user.id));
  const items = navFor(user.permissions);
  // The desktop rail and the mobile drawer can be mounted at the same time.
  // A shared layoutId across both would make motion try to animate one pill
  // between two live trees and measure a node that is no longer there.
  const pillId = useId();

  return (
    <div className="flex h-full flex-col">
      <Brand onClose={onNavigate} />

      <nav className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {GROUP_ORDER.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (!groupItems.length) return null;
          return (
            <div key={group} className="mb-5">
              <p className="mb-1.5 px-3 text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                {groupLabel(group, user.roles)}
              </p>
              <ul className="space-y-0.5">
                {groupItems.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={to === '/'}
                      onClick={onNavigate}
                      // Start the chunk on intent, so the click has nothing to wait for.
                      onMouseEnter={() => prefetchRoute(to)}
                      onFocus={() => prefetchRoute(to)}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                          isActive
                            ? 'text-ink'
                            : 'text-ink-2 hover:bg-surface-hover hover:text-ink',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive ? (
                            <motion.span
                              layoutId={`nav-active-${pillId}`}
                              transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                              className="absolute inset-0 rounded-xl bg-brand-500/12 ring-1 ring-brand-500/20 ring-inset"
                            />
                          ) : null}
                          <Icon
                            className={cn(
                              'relative size-[18px] shrink-0 transition-colors',
                              isActive ? 'text-brand-600 dark:text-brand-300' : '',
                            )}
                          />
                          <span className="relative truncate">{label}</span>
                          {to === '/notifications' && unread > 0 ? (
                            <span className="relative ml-auto grid min-w-5 place-items-center rounded-full bg-[--color-critical] px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {unread}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={user.name} hue={user.avatarHue} size="sm" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-ink">{user.name}</span>
            <span className="block truncate text-[11.5px] text-ink-3 capitalize">
              {user.rollNo ?? user.employeeId ?? user.roleName}
            </span>
          </span>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-[--color-critical]/10 hover:text-[--color-critical]"
        >
          <LogOut className="size-[18px]" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function Sidebar({
  user,
  mobileOpen,
  onCloseMobile,
}: {
  user: AuthUser;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <>
      {/* Desktop: a permanent rail. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-line bg-surface px-3 py-4 lg:block">
        <SidebarContent user={user} />
      </aside>

      {/* Mobile: an off-canvas drawer. */}
      <AnimatePresence>
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="absolute inset-0 bg-[#080a10]/55 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              className="absolute inset-y-0 left-0 w-[282px] max-w-[86vw] border-r border-line bg-surface px-3 py-4 shadow-pop"
            >
              <SidebarContent user={user} onNavigate={onCloseMobile} />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
