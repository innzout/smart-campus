import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/app/auth';
import { navFor } from '@/app/nav';
import { prefetchAll } from '@/app/routes';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';

/**
 * Shown only while a route's chunk is still downloading. It reserves height so
 * the page doesn't collapse and then jump when the content arrives.
 */
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="size-6 animate-spin text-brand-500" />
      <span className="sr-only">Loading page…</span>
    </div>
  );
}

export function Shell() {
  const user = useCurrentUser();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Warm every route this user can reach once the browser goes idle, so the
  // first click on a menu item doesn't wait on a cold chunk.
  useEffect(() => {
    prefetchAll(navFor(user.permissions).map((item) => item.to));
  }, [user.permissions]);

  // Ctrl/Cmd-K anywhere opens the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Any overlay must close on navigation — leaving a portal mounted while its
  // owner unmounts is what strands nodes mid-animation.
  useEffect(() => {
    setSearchOpen(false);
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-plane">
      <Sidebar user={user} mobileOpen={navOpen} onCloseMobile={() => setNavOpen(false)} />

      <div className="lg:pl-[264px]">
        <Topbar
          user={user}
          onOpenNav={() => setNavOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <main className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {/*
            The entrance animation is keyed on the path but has no exit — an
            exit animation would hold the outgoing page on screen while the new
            one waits to mount, which reads as a blank, laggy swap. Suspense
            lives here rather than around the router so the sidebar and topbar
            never unmount while a chunk loads.
          */}
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} permissions={user.permissions} />
    </div>
  );
}
