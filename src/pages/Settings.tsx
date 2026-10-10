import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Database,
  Download,
  KeyRound,
  Monitor,
  Moon,
  RotateCcw,
  Save,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { useAuth, useCurrentUser } from '@/app/auth';
import { useTheme, type ThemePref } from '@/app/theme';
import { resetDatabase, useDatabase } from '@/lib/store';
import { updateUser } from '@/lib/actions';
import { childrenOf, classLabel, theSchool } from '@/lib/queries';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, PageHeader } from '@/components/ui/misc';
import { cn, formatDate, num } from '@/lib/utils';

const profileSchema = z.object({
  name: z.string().trim().min(3, 'Enter your full name.'),
  email: z
    .string()
    .trim()
    .min(1, 'Enter an email address.')
    .email('That doesn’t look like a valid email address.'),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, 'Enter a valid Indian mobile number.'),
});

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Enter your current password.'),
    next: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .regex(/[A-Z]/, 'Include at least one capital letter.')
      .regex(/[a-z]/, 'Include at least one lowercase letter.')
      .regex(/\d/, 'Include at least one number.')
      .regex(/[^A-Za-z0-9]/, 'Include at least one symbol.'),
    confirm: z.string().min(1, 'Re-enter the new password.'),
  })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'The two passwords don’t match.' })
  .refine((v) => v.next !== v.current, { path: ['next'], message: 'The new password must differ from the current one.' });

function strengthOf(value: string) {
  const checks = [value.length >= 8, /[A-Z]/.test(value), /[a-z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)];
  return checks.filter(Boolean).length;
}

export default function Settings() {
  const user = useCurrentUser();
  const { logout, setActiveChild } = useAuth();
  const { preference, setPreference, resolved } = useTheme();
  const db = useDatabase();
  const school = theSchool(db);
  const [resetOpen, setResetOpen] = useState(false);

  const children = user.role === 'parent' ? childrenOf(db, user) : [];

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    mode: 'onBlur',
    defaultValues: { name: user.name, email: user.email, phone: user.phone },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    mode: 'onBlur',
    defaultValues: { current: '', next: '', confirm: '' },
  });

  const nextPassword = passwordForm.watch('next');
  const strength = strengthOf(nextPassword ?? '');

  const totalRows = Object.values(db).reduce((t, rows) => t + (Array.isArray(rows) ? rows.length : 0), 0);

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile, appearance and app preferences." />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5">
          <MotionCard>
            <CardHeader title="Profile" subtitle="How you appear across the app" />
            <CardBody className="pt-4">
              <div className="mb-6 flex items-center gap-4">
                <Avatar name={user.name} hue={user.avatarHue} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">{user.name}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-ink-3">
                    {user.roleName}
                    {user.employeeId ? ` · ${user.employeeId}` : ''}
                    {user.admissionNo ? ` · ${user.admissionNo}` : ''}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ink-3">Joined {formatDate(user.joinedOn)}</p>
                </div>
              </div>

              <form
                noValidate
                className="space-y-4"
                onSubmit={profileForm.handleSubmit(async (values) => {
                  await new Promise((r) => setTimeout(r, 300));
                  updateUser(user.id, values);
                  toast.success('Profile updated');
                })}
              >
                <Field label="Full name" error={profileForm.formState.errors.name?.message} required htmlFor="p-name">
                  <Input id="p-name" invalid={!!profileForm.formState.errors.name} {...profileForm.register('name')} />
                </Field>
                <Field label="Email address" error={profileForm.formState.errors.email?.message} required htmlFor="p-email">
                  <Input id="p-email" type="email" invalid={!!profileForm.formState.errors.email} {...profileForm.register('email')} />
                </Field>
                <Field label="Mobile number" error={profileForm.formState.errors.phone?.message} required htmlFor="p-phone">
                  <Input id="p-phone" invalid={!!profileForm.formState.errors.phone} {...profileForm.register('phone')} />
                </Field>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" loading={profileForm.formState.isSubmitting} icon={<Save className="size-4" />}>
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => profileForm.reset({ name: user.name, email: user.email, phone: user.phone })}
                  >
                    Discard
                  </Button>
                </div>
              </form>
            </CardBody>
          </MotionCard>

          <MotionCard delay={0.08}>
            <CardHeader title="Password" subtitle="Used to sign in to the app" />
            <CardBody className="pt-4">
              <form
                noValidate
                className="space-y-4"
                onSubmit={passwordForm.handleSubmit(async (values) => {
                  if (values.current !== user.password) {
                    passwordForm.setError('current', { message: 'That is not your current password.' });
                    return;
                  }
                  await new Promise((r) => setTimeout(r, 350));
                  updateUser(user.id, { password: values.next });
                  passwordForm.reset();
                  toast.success('Password changed', { description: 'Use the new password next time you sign in.' });
                })}
              >
                <Field label="Current password" error={passwordForm.formState.errors.current?.message} required htmlFor="pw-cur">
                  <Input id="pw-cur" type="password" autoComplete="current-password" invalid={!!passwordForm.formState.errors.current} {...passwordForm.register('current')} />
                </Field>

                <Field label="New password" error={passwordForm.formState.errors.next?.message} required htmlFor="pw-new">
                  <Input id="pw-new" type="password" autoComplete="new-password" invalid={!!passwordForm.formState.errors.next} {...passwordForm.register('next')} />
                </Field>

                {nextPassword ? (
                  <div>
                    <div className="flex gap-1.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            'h-1.5 flex-1 rounded-full transition-colors',
                            i < strength
                              ? strength <= 2 ? 'bg-[--color-critical]'
                                : strength <= 3 ? 'bg-[--color-warning]'
                                : 'bg-[--color-good]'
                              : 'bg-surface-2',
                          )}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[12px] text-ink-3">
                      {['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][Math.max(0, strength - 1)]} — 8+ characters with
                      upper and lower case, a number and a symbol.
                    </p>
                  </div>
                ) : null}

                <Field label="Confirm new password" error={passwordForm.formState.errors.confirm?.message} required htmlFor="pw-conf">
                  <Input id="pw-conf" type="password" autoComplete="new-password" invalid={!!passwordForm.formState.errors.confirm} {...passwordForm.register('confirm')} />
                </Field>

                <Button type="submit" loading={passwordForm.formState.isSubmitting} icon={<KeyRound className="size-4" />}>
                  Change password
                </Button>
              </form>
            </CardBody>
          </MotionCard>
        </div>

        <div className="space-y-5">
          {children.length ? (
            <MotionCard delay={0.04}>
              <CardHeader title="Your children" subtitle="Switch between children in the app" />
              <CardBody className="space-y-2 pt-4">
                {children.map((child) => {
                  const active = child.id === user.activeChildId;
                  return (
                    <button
                      key={child.id}
                      onClick={() => {
                        setActiveChild(child.id);
                        toast.success(`Now viewing ${child.name}`);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
                        active ? 'border-brand-500/50 bg-brand-500/[0.07]' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <Avatar name={child.name} hue={child.avatarHue} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{child.name}</span>
                        <span className="block truncate text-[11.5px] text-ink-3">
                          {classLabel(db, child.classId)} · roll {child.rollNo} · {child.admissionNo}
                        </span>
                      </span>
                      {active ? <span className="shrink-0 text-[11.5px] font-medium text-brand-600 dark:text-brand-300">Viewing</span> : null}
                    </button>
                  );
                })}
              </CardBody>
            </MotionCard>
          ) : null}

          <MotionCard delay={0.08}>
            <CardHeader title="Appearance" subtitle={`Currently showing ${resolved} mode`} />
            <CardBody className="pt-4">
              <div className="grid gap-2.5 sm:grid-cols-3">
                {(
                  [
                    { value: 'light', label: 'Light', icon: Sun },
                    { value: 'dark', label: 'Dark', icon: Moon },
                    { value: 'system', label: 'System', icon: Monitor },
                  ] as { value: ThemePref; label: string; icon: typeof Sun }[]
                ).map(({ value, label, icon: Icon }) => {
                  const active = preference === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setPreference(value)}
                      aria-pressed={active}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-all',
                        active ? 'border-brand-500/50 bg-brand-500/[0.07]' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <Icon className={cn('size-5', active ? 'text-brand-600 dark:text-brand-300' : 'text-ink-3')} />
                      <span className="text-[12.5px] font-medium text-ink">{label}</span>
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </MotionCard>

          <MotionCard delay={0.12}>
            <CardHeader title="School" subtitle="Your institution" />
            <CardBody className="space-y-3 pt-4">
              <dl className="space-y-2.5 text-[13px]">
                {[
                  ['School', school.shortName],
                  ['Board', school.board],
                  ['Academic year', school.academicYear],
                  ['Current term', `Term ${school.currentTerm}`],
                  ['Office', school.phone],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-ink-3">{label}</dt>
                    <dd className="text-right font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <Button variant="secondary" className="w-full" icon={<UserIcon className="size-4" />} onClick={logout}>
                Sign out
              </Button>
            </CardBody>
          </MotionCard>

          <MotionCard delay={0.16}>
            <CardHeader title="Demo data" subtitle="This prototype runs entirely in your browser" />
            <CardBody className="pt-4">
              <div className="rounded-xl bg-surface-2 px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Database className="size-4 shrink-0 text-ink-3" aria-hidden />
                  <p className="text-[13px] font-medium text-ink">
                    {num(totalRows)} records across {Object.keys(db).length} collections
                  </p>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
                  Everything you change — payments, attendance, bookings — is saved locally and
                  persists until you reset it. No server is required.
                </p>
              </div>

              <div className="mt-3.5 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  icon={<Download className="size-4" />}
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'school-data.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Data exported');
                  }}
                >
                  Export data
                </Button>
                <Button variant="outline" icon={<RotateCcw className="size-4" />} onClick={() => setResetOpen(true)}>
                  Reset demo
                </Button>
              </div>
            </CardBody>
          </MotionCard>
        </div>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset the demo?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDatabase();
                setResetOpen(false);
                toast.success('Demo reset', { description: 'Everything is back to its starting state.' });
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          Every change made during the demo — payments, attendance, meeting bookings, circulars —
          will be discarded and the starting data reloaded. Useful just before a presentation.
        </p>
      </Modal>
    </>
  );
}
