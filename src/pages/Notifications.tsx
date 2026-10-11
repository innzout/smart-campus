import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import {
  BarChart3,
  Bus,
  Bell,
  BellOff,
  CheckCheck,
  ClipboardList,
  GraduationCap,
  PartyPopper,
  Settings2,
  Users,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { notificationsFor } from '@/lib/queries';
import {
  clearNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/actions';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { cn, relativeTime } from '@/lib/utils';
import type { Notification } from '@/data/types';

const KIND: Record<Notification['kind'], { icon: typeof Bell; tone: string; label: string }> = {
  attendance: { icon: BarChart3, tone: 'bg-[--color-critical]/12 text-[--color-critical]', label: 'Attendance' },
  fee: { icon: WalletCards, tone: 'bg-[--color-warning]/16 text-[#8a5d00] dark:text-[#f5c451]', label: 'Fees' },
  homework: { icon: ClipboardList, tone: 'bg-[--s1]/12 text-[--s1]', label: 'Homework' },
  event: { icon: PartyPopper, tone: 'bg-brand-500/12 text-brand-600 dark:text-brand-300', label: 'Event' },
  result: { icon: GraduationCap, tone: 'bg-[--color-good]/12 text-[--color-good]', label: 'Result' },
  transport: { icon: Bus, tone: 'bg-[--s4]/16 text-[#8a5d00] dark:text-[#f5c451]', label: 'Transport' },
  staff: { icon: Users, tone: 'bg-[--s6]/14 text-[--s6]', label: 'Staff' },
  system: { icon: Settings2, tone: 'bg-surface-2 text-ink-2', label: 'System' },
};

export default function Notifications() {
  const user = useCurrentUser();
  const db = useDatabase();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const all = notificationsFor(db, user.id);
  const unread = all.filter((n) => !n.read);
  const list = filter === 'unread' ? unread : all;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Everything the campus wants you to know, newest first."
        action={
          <>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `All (${all.length})` },
                { value: 'unread', label: `Unread (${unread.length})` },
              ]}
            />
            {unread.length > 0 ? (
              <Button
                variant="secondary"
                icon={<CheckCheck className="size-4" />}
                onClick={() => {
                  markAllNotificationsRead(user.id);
                  toast.success('All caught up', { description: `${unread.length} marked as read.` });
                }}
              >
                Mark all read
              </Button>
            ) : null}
          </>
        }
      />

      <MotionCard>
        <CardHeader
          title={filter === 'unread' ? 'Unread' : 'All notifications'}
          subtitle={`${list.length} ${list.length === 1 ? 'item' : 'items'}`}
        />
        <CardBody className="pt-3">
          {list.length === 0 ? (
            <EmptyState
              icon={filter === 'unread' ? <BellOff className="size-6" /> : <Bell className="size-6" />}
              title={filter === 'unread' ? 'Nothing unread' : 'No notifications'}
              description={
                filter === 'unread'
                  ? 'You’ve read everything. New alerts will appear here as they arrive.'
                  : 'Attendance shortfalls, fee deadlines and graded work all land here.'
              }
              action={
                filter === 'unread' ? (
                  <Button variant="secondary" onClick={() => setFilter('all')}>
                    View all
                  </Button>
                ) : null
              }
            />
          ) : (
            <ul className="space-y-2">
              <AnimatePresence mode="popLayout">
                {list.map((n, i) => {
                  const cfg = KIND[n.kind];
                  const Icon = cfg.icon;
                  return (
                    <motion.li
                      key={n.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 32, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                      className={cn(
                        'group flex items-start gap-3.5 rounded-xl border p-4 transition-colors',
                        n.read
                          ? 'border-line bg-surface'
                          : 'border-brand-500/25 bg-brand-500/[0.05]',
                      )}
                    >
                      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', cfg.tone)}>
                        <Icon className="size-[18px]" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13.5px] font-semibold text-ink">{n.title}</p>
                          {!n.read ? (
                            <span className="size-1.5 rounded-full bg-brand-500" aria-label="Unread" />
                          ) : null}
                        </div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{n.body}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px]">
                          <span className="text-ink-3">{cfg.label}</span>
                          <span className="text-ink-3">·</span>
                          <span className="text-ink-3">{relativeTime(n.createdOn)}</span>
                          {n.link ? (
                            <Link
                              to={n.link}
                              onClick={() => markNotificationRead(n.id)}
                              className="font-medium text-brand-600 hover:underline dark:text-brand-300"
                            >
                              Open
                            </Link>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                        {!n.read ? (
                          <button
                            onClick={() => markNotificationRead(n.id)}
                            aria-label="Mark as read"
                            title="Mark as read"
                            className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-hover hover:text-ink"
                          >
                            <CheckCheck className="size-4" />
                          </button>
                        ) : null}
                        <button
                          onClick={() => clearNotification(n.id)}
                          aria-label="Dismiss notification"
                          title="Dismiss"
                          className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-[--color-critical]/10 hover:text-[--color-critical]"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </CardBody>
      </MotionCard>
    </>
  );
}
