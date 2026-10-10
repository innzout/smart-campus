import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCheck, Megaphone, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { visibleCirculars } from '@/lib/queries';
import { acknowledgeCircular, deleteCircular, postCircular } from '@/lib/actions';
import { MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { cn, formatDate, num, relativeTime } from '@/lib/utils';

const CATEGORIES = ['Exam', 'Holiday', 'Event', 'Fee', 'PTM', 'Transport', 'General'] as const;

const CATEGORY_TONE: Record<string, Tone> = {
  Exam: 'critical',
  Holiday: 'good',
  Event: 'brand',
  Fee: 'warning',
  PTM: 'info',
  Transport: 'warning',
  General: 'neutral',
};

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(8, 'Give the circular a clear title (8+ characters).')
    .max(120, 'Keep the title under 120 characters.'),
  category: z.enum(CATEGORIES),
  body: z.string().trim().min(40, 'Write at least 40 characters so parents know what to do.'),
  pinned: z.boolean(),
});

export default function Circulars() {
  const user = useCurrentUser();
  const db = useDatabase();
  const can = useCan();

  const canPost = can('circular.post');
  const canDelete = can('circular.delete');
  const isParent = user.role === 'parent';

  const [category, setCategory] = useState<'all' | (typeof CATEGORIES)[number]>('all');
  const [query, setQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { title: '', category: 'General', body: '', pinned: false },
  });

  const all = visibleCirculars(db);
  const list = all.filter((c) => {
    const matchesCategory = category === 'all' || c.category === category;
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || c.title.toLowerCase().includes(q) || c.body.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  const unread = all.filter((c) => !c.acknowledgedBy.includes(user.id)).length;

  return (
    <>
      <PageHeader
        title="Circulars"
        subtitle={
          isParent
            ? `Notices from the school. ${unread ? `${unread} still to acknowledge.` : 'All acknowledged — thank you.'}`
            : 'Notices sent to parents, with acknowledgement tracking.'
        }
        action={
          canPost ? (
            <Button onClick={() => setComposeOpen(true)} icon={<Plus className="size-4" />}>
              Post circular
            </Button>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search circulars…"
          aria-label="Search circulars"
          leading={<Search className="size-4" />}
          className="h-10 w-full sm:w-72"
        />
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          <Segmented
            size="sm"
            value={category}
            onChange={setCategory}
            options={[{ value: 'all' as const, label: 'All' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
          />
        </div>
      </div>

      {list.length === 0 ? (
        <MotionCard>
          <EmptyState
            icon={<Megaphone className="size-6" />}
            title="No circulars found"
            description={query ? `Nothing matches “${query}”.` : 'There are no notices in this category.'}
          />
        </MotionCard>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((c, i) => {
              const open = expanded === c.id;
              const acknowledged = c.acknowledgedBy.includes(user.id);
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.32, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    'flex min-w-0 flex-col rounded-2xl border bg-surface p-5 shadow-card',
                    c.pinned ? 'border-brand-500/35' : 'border-line',
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <Badge tone={CATEGORY_TONE[c.category] ?? 'neutral'}>{c.category}</Badge>
                    <div className="flex shrink-0 items-center gap-1">
                      {c.pinned ? (
                        <span className="grid size-7 place-items-center rounded-lg bg-brand-500/12 text-brand-600 dark:text-brand-300" title="Pinned">
                          <Pin className="size-3.5" />
                        </span>
                      ) : null}
                      {canDelete ? (
                        <button
                          onClick={() => {
                            deleteCircular(c.id);
                            toast.success('Circular removed', { description: c.title });
                          }}
                          aria-label={`Delete ${c.title}`}
                          className="grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-[--color-critical]/10 hover:text-[--color-critical]"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <h2 className="text-[15px] leading-snug font-semibold text-ink">{c.title}</h2>
                  {c.titleTa ? <p className="mt-0.5 text-[12.5px] text-ink-3">{c.titleTa}</p> : null}

                  <p className={cn('mt-2 flex-1 text-[13px] leading-relaxed text-ink-2', !open && 'line-clamp-4')}>
                    {c.body}
                  </p>

                  <button
                    onClick={() => setExpanded(open ? null : c.id)}
                    className="mt-2.5 self-start text-[12.5px] font-medium text-brand-600 hover:underline dark:text-brand-300"
                  >
                    {open ? 'Show less' : 'Read more'}
                  </button>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                    <span className="min-w-0 text-[11.5px] text-ink-3">
                      <span className="block truncate">{c.author}</span>
                      <span className="block" title={formatDate(c.postedOn)}>{relativeTime(c.postedOn)}</span>
                    </span>

                    {isParent ? (
                      acknowledged ? (
                        <Badge tone="good" icon={<CheckCheck className="size-3" />}>Acknowledged</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            acknowledgeCircular(c.id, user.id);
                            toast.success('Acknowledged', { description: 'The school can see you have read this.' });
                          }}
                        >
                          Acknowledge
                        </Button>
                      )
                    ) : (
                      <Badge tone="neutral">{num(c.acknowledgedBy.length)} read</Badge>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Post a circular"
        description="Every parent is notified immediately, and acknowledgements are tracked."
        footer={
          <>
            <Button variant="secondary" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button form="compose" type="submit" loading={isSubmitting}>Publish</Button>
          </>
        }
      >
        <form
          id="compose"
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit(async (values) => {
            await new Promise((r) => setTimeout(r, 350));
            postCircular({ ...values, author: user.name });
            toast.success('Circular published', { description: 'Parents have been notified.' });
            reset();
            setComposeOpen(false);
          })}
        >
          <Field label="Title" error={errors.title?.message} required htmlFor="c-title">
            <Input id="c-title" placeholder="Parent–Teacher Meeting on Saturday" invalid={!!errors.title} {...register('title')} />
          </Field>

          <Field label="Category" error={errors.category?.message} required htmlFor="c-cat">
            <Select id="c-cat" invalid={!!errors.category} {...register('category')}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>

          <Field
            label="Message"
            error={errors.body?.message}
            hint="Say what is happening, who it affects, and what parents must do."
            required
            htmlFor="c-body"
          >
            <Textarea id="c-body" rows={6} invalid={!!errors.body} {...register('body')} />
          </Field>

          <Checkbox label="Pin to the top for everyone" {...register('pinned')} />
        </form>
      </Modal>
    </>
  );
}
