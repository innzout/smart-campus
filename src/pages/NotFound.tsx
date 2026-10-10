import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Compass, LayoutDashboard, LifeBuoy, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/auth';
import { navFor } from '@/app/nav';

/**
 * 404. Rendered both inside the shell (signed in) and standalone (signed out),
 * so it carries its own background and never assumes a sidebar is present.
 */
export default function NotFound() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Suggest the pages whose names are closest to what was typed.
  const suggestions = (user ? navFor(user.permissions) : [])
    .map((item) => {
      const slug = pathname.replace(/^\//, '').toLowerCase();
      const target = item.to.replace(/^\//, '').toLowerCase();
      const score =
        slug && (target.startsWith(slug.slice(0, 3)) || item.label.toLowerCase().includes(slug))
          ? 2
          : 0;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((s) => s.item);

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-16">
      <div className="aurora" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg text-center"
      >
        <motion.div
          animate={{ rotate: [0, 12, -8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-auto grid size-20 place-items-center rounded-3xl border border-line bg-surface text-brand-600 shadow-pop dark:text-brand-300"
        >
          <Compass className="size-9" />
        </motion.div>

        <p className="mt-8 text-[80px] leading-none font-semibold tracking-tighter text-gradient sm:text-[104px]">
          404
        </p>

        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">
          This corridor doesn’t exist
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ink-2">
          We couldn’t find{' '}
          <code className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[12.5px] font-medium text-ink">
            {pathname}
          </code>
          . The page may have been moved, or the link you followed is out of date.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          <Button onClick={() => navigate(-1)} variant="secondary" icon={<ArrowLeft className="size-4" />}>
            Go back
          </Button>
          <Button onClick={() => navigate(user ? '/' : '/login')} icon={<LayoutDashboard className="size-4" />}>
            {user ? 'Back to dashboard' : 'Go to sign in'}
          </Button>
        </div>

        {suggestions.length ? (
          <div className="mt-10 rounded-2xl border border-line bg-surface p-4 text-left shadow-card">
            <p className="mb-2.5 flex items-center gap-1.5 px-1 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
              <Search className="size-3" aria-hidden /> Were you looking for
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {suggestions.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
                  >
                    <Icon className="size-4 shrink-0 text-ink-3" />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-7 flex items-center justify-center gap-1.5 text-[12.5px] text-ink-3">
          <LifeBuoy className="size-3.5" aria-hidden />
          Still stuck?{' '}
          <Link
            to={user ? '/complaints' : '/login'}
            className="font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            Raise a support ticket
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
