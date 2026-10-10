import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Bus,
  Eye,
  EyeOff,
  GraduationCap,
  IdCard,
  Receipt,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { theSchool } from '@/lib/queries';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';

const schema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email address or student ID.'),
  password: z.string().min(1, 'Enter your password.'),
});

type FormValues = z.infer<typeof schema>;

const DEMO = [
  {
    role: 'Parent',
    identifier: 'parent@school.edu',
    password: 'Parent@123',
    icon: UserRound,
    blurb: 'Attendance, fees, report card, bus',
  },
  {
    role: 'Class Teacher',
    identifier: 'teacher@school.edu',
    password: 'Teacher@123',
    icon: Users,
    blurb: 'Mark the register, set homework, enter marks',
  },
  {
    role: 'Correspondent',
    identifier: 'admin@school.edu',
    password: 'Admin@123',
    icon: UserCog,
    blurb: 'Fee collection, attendance, whole school',
  },
  {
    role: 'Student',
    identifier: 'student@school.edu',
    password: 'Student@123',
    icon: GraduationCap,
    blurb: 'Homework, timetable, report card',
  },
];

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: 'Parents know the same day',
    body: 'Absent marked at assembly, parent notified before lunch — no phone calls to the office.',
  },
  {
    icon: Receipt,
    title: 'Fees collected without the queue',
    body: 'Pay term and bus fees from the phone, receipt issued instantly, defaulter list always current.',
  },
  {
    icon: Bus,
    title: 'Everything parents ask about',
    body: 'Report cards, circulars, PTM slots, bus route and gate pass — in one app.',
  },
];

export default function Login() {
  const { login } = useAuth();
  const db = useDatabase();
  const school = theSchool(db);
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { identifier: '', password: '' },
  });

  // The student ID a parent would actually be given by the school.
  const demoAdmissionNo =
    db.users.find((u) => u.email === 'student@school.edu')?.admissionNo ?? '';

  const onSubmit = async (values: FormValues) => {
    setFormError('');
    await new Promise((r) => setTimeout(r, 300));
    const result = login(values.identifier, values.password);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from !== '/login' ? from : '/', { replace: true });
  };

  const useDemo = (identifier: string, password: string) => {
    setValue('identifier', identifier, { shouldValidate: true });
    setValue('password', password, { shouldValidate: true });
    setFormError('');
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-plane">
      <div className="aurora" aria-hidden />

      <div className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-12 px-5 py-10 lg:grid-cols-[1.05fr_minmax(0,27rem)] lg:gap-16 lg:px-8">
        {/* ── Pitch column ── */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block"
        >
          <div className="mb-7 inline-flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/25">
              <GraduationCap className="size-6" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-ink">{school.shortName}</span>
              <span className="block text-[12px] text-ink-3">
                {school.tagline}
                <span className="ml-1.5 opacity-70">· {school.taglineEn}</span>
              </span>
            </span>
          </div>

          <h1 className="max-w-xl text-[42px] leading-[1.08] font-semibold tracking-tight text-ink">
            The whole school, <span className="text-gradient">in every parent’s pocket.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-2">
            Attendance, fees, homework, report cards and circulars — one app for parents, one
            register for teachers, and one clear picture for the office.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }, i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.15 + i * 0.1 }}
                className="flex gap-4"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-brand-600 shadow-card dark:text-brand-300">
                  <Icon className="size-[18px]" />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-ink">{title}</span>
                  <span className="mt-0.5 block max-w-md text-[13px] leading-relaxed text-ink-3">
                    {body}
                  </span>
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        {/* ── Form column ── */}
        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full rounded-3xl border border-line bg-surface p-6 shadow-pop sm:p-8"
        >
          <div className="mb-7 lg:hidden">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <GraduationCap className="size-6" />
            </span>
          </div>

          <h2 className="text-[22px] font-semibold tracking-tight text-ink">Sign in</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-3">
            Parents can use the student ID printed on the diary.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
            <Field
              label="Email or Student ID"
              error={errors.identifier?.message}
              required
              htmlFor="email"
            >
              <Input
                id="email"
                autoComplete="username"
                placeholder={demoAdmissionNo || 'you@school.edu'}
                leading={<IdCard className="size-4" />}
                invalid={!!errors.identifier}
                {...register('identifier')}
              />
            </Field>

            <Field label="Password" error={errors.password?.message} required htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  invalid={!!errors.password}
                  className="pr-11"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[12.5px] text-ink-3">Stay signed in on this device</span>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="text-[12.5px] font-medium text-brand-600 hover:underline dark:text-brand-300"
              >
                Need help?
              </button>
            </div>

            {formError ? (
              <motion.div
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-2.5 rounded-xl bg-[--color-critical]/10 px-3.5 py-3 text-[13px] font-medium text-[--color-critical] ring-1 ring-[--color-critical]/25 ring-inset"
              >
                <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
                {formError}
              </motion.div>
            ) : null}

            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              className="w-full"
              icon={isSubmitting ? undefined : <ArrowRight className="size-4" />}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-7 border-t border-line pt-5">
            <p className="mb-3 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
              Demo accounts
            </p>
            <div className="space-y-2">
              {DEMO.map(({ role, identifier, password, icon: Icon, blurb }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => useDemo(identifier, password)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:border-brand-500/40 hover:bg-surface"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-500/12 text-brand-600 dark:text-brand-300">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">{role}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">{blurb}</span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>

            {demoAdmissionNo ? (
              <button
                type="button"
                onClick={() => useDemo(demoAdmissionNo, 'Parent@123')}
                className="mt-2 w-full rounded-xl border border-dashed border-line px-3 py-2.5 text-left text-[12px] text-ink-3 transition-colors hover:border-brand-500/40 hover:text-ink-2"
              >
                <span className="font-medium text-ink-2">Or sign in as a parent with the student ID:</span>{' '}
                <span className="tnum">{demoAdmissionNo}</span>
              </button>
            ) : null}
          </div>
        </motion.section>
      </div>

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Signing in"
        description="How parents and staff access the app."
        size="sm"
        footer={<Button onClick={() => setHelpOpen(false)}>Got it</Button>}
      >
        <ul className="space-y-3 text-[13.5px] leading-relaxed text-ink-2">
          <li>
            <span className="font-semibold text-ink">Parents</span> sign in with the student ID
            printed on the school diary — for example <span className="tnum">{demoAdmissionNo}</span> — or
            with their registered email address.
          </li>
          <li>
            <span className="font-semibold text-ink">Teachers and office staff</span> sign in with
            their school email address.
          </li>
          <li>
            Forgotten your password? The school office can reset it from the Students &amp; Staff
            page. In this demo, use the accounts listed on the sign-in screen.
          </li>
        </ul>
      </Modal>
    </div>
  );
}
