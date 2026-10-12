import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, LifeBuoy, Send, Wrench } from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { allRequests, sectionLabel, requestsFor, userById } from '@/lib/queries';
import { advanceRequest, raiseRequest } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Badge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { formatDate, relativeTime } from '@/lib/utils';
import type { HelpRequest } from '@/data/types';

const CATEGORIES = ['Leave', 'Transport', 'Fee', 'Certificate', 'Facility', 'Other'] as const;

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(10, 'Summarise your request in at least 10 characters.')
    .max(110, 'Keep the title under 110 characters.'),
  category: z.enum(CATEGORIES),
  description: z
    .string()
    .trim()
    .min(25, 'Give the office enough detail to act on — at least 25 characters.')
    .max(800, 'Keep it under 800 characters.'),
});

export default function Requests() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const db = useDatabase();
  const can = useCan();

  const isStaff = can('request.view.all');
  const [filter, setFilter] = useState<'all' | HelpRequest['status']>('all');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { title: '', category: 'Leave', description: '' },
  });

  const scope = isStaff
    ? allRequests(db)
    : can('request.view.self')
      ? requestsFor(db, user.id)
      : [];
  const list = scope.filter((r) => filter === 'all' || r.status === filter);

  return (
    <>
      <PageHeader
        title="Help Desk"
        subtitle={
          isStaff
            ? 'Requests from parents and staff — leave, certificates, transport and facilities.'
            : 'Ask the school office for leave, a certificate or any change you need.'
        }
      />

      <StatGrid>
        <StatTile label="Total requests" value={scope.length} note={isStaff ? 'From everyone' : 'Raised by you'} icon={LifeBuoy} />
        <StatTile label="Open" value={scope.filter((r) => r.status === 'open').length} note="Not yet picked up" icon={Clock} tone="warning" delay={0.06} />
        <StatTile label="In progress" value={scope.filter((r) => r.status === 'in-progress').length} note="Being handled" icon={Wrench} delay={0.12} />
        <StatTile label="Resolved" value={scope.filter((r) => r.status === 'resolved').length} note="Closed" icon={CheckCircle2} tone="good" delay={0.18} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,26rem)_1fr]">
        {can('request.raise') ? (
          <MotionCard delay={0.1} className="self-start">
            <CardHeader title="Raise a request" subtitle="The office usually replies within two working days." />
            <CardBody className="pt-4">
              <form
                noValidate
                className="space-y-4"
                onSubmit={handleSubmit(async (values) => {
                  await new Promise((r) => setTimeout(r, 380));
                  const ref = raiseRequest({
                    raisedBy: user.id,
                    aboutStudentId: subject?.id,
                    title: values.title,
                    category: values.category,
                    description: values.description,
                  });
                  toast.success(`Request ${ref} sent`, { description: 'You will be notified as it progresses.' });
                  reset();
                })}
              >
                <Field label="What do you need?" error={errors.title?.message} required htmlFor="r-title">
                  <Input id="r-title" placeholder="Leave for two days — family function" invalid={!!errors.title} {...register('title')} />
                </Field>

                <Field label="Category" error={errors.category?.message} required htmlFor="r-cat">
                  <Select id="r-cat" invalid={!!errors.category} {...register('category')}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Details"
                  error={errors.description?.message}
                  hint="Dates, reason, and anything the office should know."
                  required
                  htmlFor="r-desc"
                >
                  <Textarea id="r-desc" rows={5} invalid={!!errors.description} {...register('description')} />
                </Field>

                <Button type="submit" loading={isSubmitting} className="w-full" icon={<Send className="size-4" />}>
                  Send request
                </Button>
              </form>
            </CardBody>
          </MotionCard>
        ) : null}

        <MotionCard delay={0.16}>
          <CardHeader
            title={isStaff ? 'All requests' : 'Your requests'}
            subtitle={`${list.length} shown`}
            action={
              <Segmented
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'open', label: 'Open' },
                  { value: 'in-progress', label: 'Active' },
                  { value: 'resolved', label: 'Resolved' },
                ]}
              />
            }
          />
          <CardBody className="pt-4">
            {list.length === 0 ? (
              <EmptyState
                icon={<LifeBuoy className="size-6" />}
                title="Nothing here"
                description={filter === 'all' ? 'No requests have been raised yet.' : 'No requests with this status.'}
              />
            ) : (
              <ul className="space-y-3">
                {list.map((r, i) => {
                  const raiser = userById(db, r.raisedBy);
                  const about = userById(db, r.aboutStudentId);
                  return (
                    <motion.li
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="rounded-xl border border-line p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="tnum text-[11.5px] font-semibold text-ink-3">{r.ref}</span>
                        <StatusPill status={r.status} />
                        <Badge tone="neutral">{r.category}</Badge>
                      </div>

                      <h3 className="mt-2 text-[14px] font-semibold text-ink">{r.title}</h3>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed whitespace-pre-line text-ink-2">
                        {r.description}
                      </p>

                      {isStaff ? (
                        <p className="mt-1.5 text-[11.5px] text-ink-3">
                          Raised by {raiser?.name ?? 'Unknown'}
                          {about ? ` · about ${about.name} (${sectionLabel(db, about.sectionId)})` : ''}
                        </p>
                      ) : null}

                      {r.updates.length ? (
                        <ol className="mt-3.5 space-y-2 border-t border-line pt-3">
                          {r.updates.map((u, ui) => (
                            <li key={ui} className="flex gap-2.5 text-[12px]">
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                              <span className="min-w-0">
                                <span className="block text-ink-2">{u.note}</span>
                                <span className="block text-[11px] text-ink-3">{formatDate(u.on)}</span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : null}

                      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                        <span className="text-[11.5px] text-ink-3">Raised {relativeTime(r.createdOn)}</span>

                        {can('request.resolve') && r.status !== 'resolved' ? (
                          <div className="flex gap-2">
                            {r.status === 'open' ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  advanceRequest(r.id, 'Acknowledged by the school office.');
                                  toast.success(`${r.ref} acknowledged`);
                                }}
                              >
                                Acknowledge
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              onClick={() => {
                                advanceRequest(r.id, 'Completed. Please collect from the office if applicable.');
                                toast.success(`${r.ref} resolved`);
                              }}
                            >
                              Resolve
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </MotionCard>
      </div>
    </>
  );
}
