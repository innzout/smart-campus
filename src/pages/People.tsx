import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { GraduationCap, Phone, Plus, Search, UserCheck, Users, UserX } from 'lucide-react';
import { useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { attendanceFor, classLabel, feeSummary, summariseAttendance, userById } from '@/lib/queries';
import { admitStudent, toggleUserStatus } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, StatusPill } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/Table';
import { Avatar, EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { ATTENDANCE_THRESHOLD, cn, money, num, pct, todayISO } from '@/lib/utils';
import { primaryRole, roleName } from '@/services/auth.service';
import { DESIGNATION_LABEL } from '@/data/types';
import type { User } from '@/data/types';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Enter the student’s full name.')
    .regex(/^[A-Za-z.'\- ]+$/, 'Names use letters, spaces, hyphens and full stops only.'),
  classId: z.string().min(1, 'Choose a class.'),
  rollNo: z.coerce.number({ message: 'Enter a roll number.' }).int().min(1).max(99),
  guardianName: z.string().trim().min(3, 'Enter the parent or guardian’s name.'),
  guardianPhone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, 'Enter a valid Indian mobile number.'),
  dateOfBirth: z.string().min(1, 'Enter the date of birth.'),
});

export default function People() {
  const user = useCurrentUser();
  const db = useDatabase();
  const can = useCan();

  const [tab, setTab] = useState<'students' | 'staff'>('students');
  // Seeing the staff register is a separate matter from seeing the children —
  // a librarian has business with one and not the other.
  const canSeeStaff = can('staff.view');
  const [classId, setClassId] = useState<'all' | string>('all');
  const [query, setQuery] = useState('');
  const [admitOpen, setAdmitOpen] = useState(false);
  const [detail, setDetail] = useState<User | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { name: '', classId: db.classes[0]?.id ?? '', rollNo: 1, guardianName: '', guardianPhone: '', dateOfBirth: '' },
  });

  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.users
      .filter((u) => u.roles.includes('student'))
      .filter((u) => (classId === 'all' ? true : u.classId === classId))
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          (u.admissionNo ?? '').toLowerCase().includes(q) ||
          String(u.rollNo ?? '').includes(q),
      );
  }, [db.users, classId, query]);

  const staff = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.users
      .filter((u) => !!u.employeeId)
      .filter((u) => !q || u.name.toLowerCase().includes(q) || (u.employeeId ?? '').toLowerCase().includes(q));
  }, [db.users, query]);

  const studentColumns: Column<User>[] = [
    { key: 'roll', header: 'Roll', align: 'right', sortBy: (u) => u.rollNo ?? 0, cell: (u) => <span className="tnum">{u.rollNo}</span> },
    {
      key: 'name',
      header: 'Student',
      sortBy: (u) => u.name,
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} hue={u.avatarHue} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{u.name}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{u.admissionNo}</p>
          </div>
        </div>
      ),
    },
    { key: 'class', header: 'Class', sortBy: (u) => classLabel(db, u.classId), cell: (u) => classLabel(db, u.classId) },
    {
      key: 'attendance',
      header: 'Attendance',
      align: 'right',
      hideOnMobile: true,
      sortBy: (u) => summariseAttendance(attendanceFor(db, u.id)).percent,
      cell: (u) => {
        const s = summariseAttendance(attendanceFor(db, u.id));
        return (
          <span className={cn('tnum font-semibold', s.percent < ATTENDANCE_THRESHOLD ? 'text-[--color-critical]' : 'text-ink')}>
            {pct(s.percent, 0)}
          </span>
        );
      },
    },
    {
      key: 'fees',
      header: 'Fees due',
      align: 'right',
      hideOnMobile: true,
      sortBy: (u) => feeSummary(db, u.id).pending,
      cell: (u) => {
        const f = feeSummary(db, u.id);
        return (
          <span className={cn('tnum', f.pending ? 'font-semibold text-[--color-critical]' : 'text-ink-3')}>
            {money(f.pending)}
          </span>
        );
      },
    },
    { key: 'status', header: 'Status', align: 'center', sortBy: (u) => u.status, cell: (u) => <StatusPill status={u.status} /> },
  ];

  const staffColumns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      sortBy: (u) => u.name,
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} hue={u.avatarHue} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{u.name}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'employeeId', header: 'Employee ID', hideOnMobile: true, sortBy: (u) => u.employeeId ?? '', cell: (u) => <span className="tnum">{u.employeeId}</span> },
    {
      key: 'designation',
      header: 'Designation',
      sortBy: (u) => u.designation ?? '',
      cell: (u) => (
        <span>
          <span className="block text-[13px] text-ink">
            {u.designation ? DESIGNATION_LABEL[u.designation] : '—'}
          </span>
          {u.qualification ? (
            <span className="block text-[11.5px] text-ink-3">{u.qualification}</span>
          ) : null}
        </span>
      ),
    },
    {
      // Designation is what they are employed as; roles are what they may do,
      // and in a school this size one person routinely holds several.
      key: 'roles',
      header: 'Roles',
      hideOnMobile: true,
      cell: (u) => (
        <span className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Badge key={r} tone={r === primaryRole(u.roles) ? 'brand' : 'neutral'}>
              {roleName(r)}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'classTeacher',
      header: 'Class teacher of',
      align: 'center',
      hideOnMobile: true,
      cell: (u) => {
        const cls = db.classes.find((c) => c.classTeacherId === u.id);
        return cls ? <Badge tone="info">{cls.label}</Badge> : <span className="text-ink-3">—</span>;
      },
    },
    { key: 'phone', header: 'Phone', align: 'right', hideOnMobile: true, cell: (u) => <span className="tnum">{u.phone}</span> },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (u) =>
        can('staff.manage') && u.id !== user.id ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              toggleUserStatus(u.id);
              toast.success(`${u.name} is now ${u.status === 'active' ? 'inactive' : 'active'}`);
            }}
          >
            {u.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
        ) : null,
    },
  ];

  const allStudents = db.users.filter((u) => u.roles.includes('student'));

  return (
    <>
      <PageHeader
        title="Students & Staff"
        subtitle={`${num(allStudents.length)} students on roll · ${num(staff.length)} staff · ${db.classes.length} classes`}
        action={
          can('student.manage') ? (
            <Button onClick={() => setAdmitOpen(true)} icon={<Plus className="size-4" />}>
              Admit student
            </Button>
          ) : null
        }
      />

      <StatGrid>
        <StatTile label="Students on roll" value={num(allStudents.length)} note={`Across ${db.classes.length} classes`} icon={Users} />
        <StatTile label="Teaching staff" value={num(db.users.filter((u) => u.roles.includes('subject-teacher') || u.roles.includes('class-teacher')).length)} note="Class and subject teachers" icon={GraduationCap} delay={0.06} />
        <StatTile label="Parent accounts" value={num(db.users.filter((u) => u.roles.includes('parent')).length)} note="Using the mobile app" icon={UserCheck} tone="good" delay={0.12} />
        <StatTile label="Inactive" value={num(db.users.filter((u) => u.status === 'inactive').length)} note="Cannot sign in" icon={UserX} tone={db.users.some((u) => u.status === 'inactive') ? 'warning' : 'good'} delay={0.18} />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader
          title={tab === 'students' ? 'Student directory' : 'Staff directory'}
          subtitle={`${tab === 'students' ? students.length : staff.length} shown`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, admission no…"
                aria-label="Search people"
                leading={<Search className="size-4" />}
                className="h-9 w-full text-[13px] sm:w-56"
              />
              <Segmented
                size="sm"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'students', label: 'Students' },
                  ...(canSeeStaff ? [{ value: 'staff' as const, label: 'Staff' }] : []),
                ]}
              />
            </div>
          }
        />
        <CardBody className="pt-4">
          {tab === 'students' ? (
            <>
              <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
                <Segmented
                  size="sm"
                  value={classId}
                  onChange={setClassId}
                  options={[
                    { value: 'all' as const, label: 'All classes' },
                    ...db.classes.map((c) => ({ value: c.id, label: c.label })),
                  ]}
                />
              </div>
              <DataTable
                columns={studentColumns}
                rows={students}
                initialSort={{ key: 'roll', dir: 'asc' }}
                onRowClick={setDetail}
                empty={<EmptyState icon={<Search className="size-6" />} title="No students match" />}
              />
            </>
          ) : (
            <DataTable
              columns={staffColumns}
              rows={staff}
              initialSort={{ key: 'name', dir: 'asc' }}
              empty={<EmptyState icon={<Search className="size-6" />} title="No staff match" />}
            />
          )}
        </CardBody>
      </MotionCard>

      {/* student detail */}
      {detail ? (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={detail.name}
          description={`${classLabel(db, detail.classId)} · roll ${detail.rollNo} · ${detail.admissionNo}`}
          footer={<Button onClick={() => setDetail(null)}>Close</Button>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Attendance', pct(summariseAttendance(attendanceFor(db, detail.id)).percent, 1)],
              ['Fees outstanding', money(feeSummary(db, detail.id).pending)],
              ['Date of birth', detail.dateOfBirth ?? '—'],
              ['Blood group', detail.bloodGroup ?? '—'],
              ['Guardian', userById(db, detail.guardianIds?.[0])?.name ?? '—'],
              ['Guardian phone', userById(db, detail.guardianIds?.[0])?.phone ?? '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-2 px-3.5 py-3">
                <p className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{label}</p>
                <p className="mt-1 text-[13.5px] font-medium text-ink">{value}</p>
              </div>
            ))}
          </div>
          <a
            href={`tel:${(userById(db, detail.guardianIds?.[0])?.phone ?? '').replace(/\s/g, '')}`}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-500"
          >
            <Phone className="size-4" /> Call guardian
          </a>
        </Modal>
      ) : null}

      {/* admission */}
      <Modal
        open={admitOpen}
        onClose={() => setAdmitOpen(false)}
        title="Admit a student"
        description="A parent account is created automatically and linked to the child."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdmitOpen(false)}>Cancel</Button>
            <Button form="admit-form" type="submit" loading={isSubmitting}>Admit</Button>
          </>
        }
      >
        <form
          id="admit-form"
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit(async (values) => {
            await new Promise((r) => setTimeout(r, 400));
            admitStudent({
              name: values.name as string,
              classId: values.classId as string,
              rollNo: Number(values.rollNo),
              guardianName: values.guardianName as string,
              guardianPhone: values.guardianPhone as string,
              dateOfBirth: values.dateOfBirth as string,
            });
            toast.success(`${values.name} admitted`, { description: 'A parent login has been created.' });
            reset();
            setAdmitOpen(false);
          })}
        >
          <Field label="Student name" error={errors.name?.message} required htmlFor="s-name">
            <Input id="s-name" placeholder="Nandhini R." invalid={!!errors.name} {...register('name')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Class" error={errors.classId?.message} required htmlFor="s-class">
              <Select id="s-class" invalid={!!errors.classId} {...register('classId')}>
                {db.classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Roll number" error={errors.rollNo?.message} required htmlFor="s-roll">
              <Input id="s-roll" type="number" min={1} max={99} invalid={!!errors.rollNo} {...register('rollNo')} />
            </Field>
          </div>

          <Field label="Date of birth" error={errors.dateOfBirth?.message} required htmlFor="s-dob">
            <Input id="s-dob" type="date" max={todayISO()} invalid={!!errors.dateOfBirth} {...register('dateOfBirth')} />
          </Field>

          <Field label="Parent / guardian name" error={errors.guardianName?.message} required htmlFor="s-guardian">
            <Input id="s-guardian" placeholder="R. Lakshmi" invalid={!!errors.guardianName} {...register('guardianName')} />
          </Field>

          <Field
            label="Guardian mobile"
            error={errors.guardianPhone?.message}
            hint="Used for the parent app login and SMS alerts."
            required
            htmlFor="s-phone"
          >
            <Input id="s-phone" placeholder="+91 98430 12345" invalid={!!errors.guardianPhone} {...register('guardianPhone')} />
          </Field>
        </form>
      </Modal>
    </>
  );
}
