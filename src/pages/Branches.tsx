import { useState } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  Info,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useCan } from '@/app/auth';
import { useWholeDatabase } from '@/lib/store';
import { theGroup } from '@/lib/queries';
import { createBranch } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, PageHeader } from '@/components/ui/misc';
import { num } from '@/lib/utils';

/**
 * The trust and its branches.
 *
 * A trust that runs three schools wants one account that can open a fourth and
 * appoint its Correspondent, without being able to wander into another branch's
 * fee ledger. That separation is a database concern — row-level isolation per
 * tenant — and it is the one thing on this screen the prototype cannot honestly
 * do, so the screen says so rather than implying otherwise.
 */
export default function Branches() {
  // Deliberately unscoped: this page compares the branches against each other.
  const db = useWholeDatabase();
  const can = useCan();
  const manage = can('org.manage');
  const group = theGroup(db);

  const [open, setOpen] = useState(false);

  const students = db.users.filter((u) => u.roles.includes('student'));
  const staff = db.users.filter((u) => !!u.employeeId);

  return (
    <>
      <PageHeader
        title={group.name}
        subtitle={`${group.trustName} · ${group.registrationNo} · ${db.schools.length} branches`}
        action={
          manage ? (
            <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
              Open a branch
            </Button>
          ) : null
        }
      />

      <StatGrid>
        <StatTile label="Branches" value={db.schools.length} note="Under the trust" icon={Building2} />
        <StatTile
          label="Students"
          value={num(students.length)}
          note="Across the group"
          icon={Users}
          delay={0.06}
        />
        <StatTile
          label="Staff"
          value={staff.length}
          note="Teaching and non-teaching"
          icon={ShieldCheck}
          delay={0.12}
        />
        <StatTile
          label="Chairman"
          value={group.chairman.replace(/^(Mr|Mrs|Dr)\. /, '')}
          note="Trust correspondence"
          icon={Mail}
          delay={0.18}
        />
      </StatGrid>

      {/* Stated up front, because a correspondent will ask and should not be
          told something that isn't true. */}
      <div className="mb-5 flex gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3.5">
        <Info className="mt-px size-4 shrink-0 text-ink-3" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">About multiple branches in this prototype.</span>{' '}
          Branches and their administrators are real records, and you can open one here. What is not
          yet enforced is isolation — this build holds one school's data, so a branch administrator
          would see the whole group. Keeping each branch's data genuinely separate needs the server,
          where it is done with row-level security in the database rather than by filtering in the
          app. That is the honest line between what you are seeing and what ships.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {db.schools.map((school, i) => {
          const admins = db.users.filter(
            (u) => u.schoolId === school.id && u.roles.includes('correspondent'),
          );
          const onRoll = students.filter((u) => u.schoolId === school.id).length;
          return (
            <MotionCard key={school.id} delay={0.1 + i * 0.06}>
              <CardHeader
                title={school.shortName}
                subtitle={`${school.board} · ${school.code}`}
                action={
                  school.isMain ? (
                    <Badge tone="brand">Main campus</Badge>
                  ) : (
                    <Badge tone="neutral">Branch</Badge>
                  )
                }
              />
              <CardBody className="space-y-3 pt-4">
                <dl className="space-y-2 rounded-xl bg-surface-2 px-4 py-3 text-[12.5px]">
                  {[
                    [MapPin, `${school.address}, ${school.city}`],
                    [Phone, school.phone],
                    [Mail, school.email],
                  ].map(([Icon, value], k) => {
                    const Lucide = Icon as typeof MapPin;
                    return (
                      <div key={k} className="flex items-center gap-2.5">
                        <Lucide className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                        <dd className="min-w-0 truncate text-ink-2">{value as string}</dd>
                      </div>
                    );
                  })}
                </dl>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">Academic year {school.academicYear}</Badge>
                  <Badge tone="neutral">Term {school.currentTerm}</Badge>
                  {onRoll > 0 ? <Badge tone="good">{num(onRoll)} on roll</Badge> : null}
                </div>

                <div>
                  <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
                    Administrator
                  </p>
                  {admins.length === 0 ? (
                    <p className="text-[12.5px] text-ink-3">
                      No administrator appointed for this branch yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {admins.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-3 rounded-xl border border-line px-3 py-2"
                        >
                          <Avatar name={a.name} hue={a.avatarHue} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">
                              {a.name}
                            </span>
                            <span className="block truncate text-[11.5px] text-ink-3">
                              {a.email}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardBody>
            </MotionCard>
          );
        })}
      </div>

      <NewBranchDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ── opening a branch ─────────────────────────────────────────────────── */

function NewBranchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const valid =
    name.trim().length > 4 &&
    shortName.trim().length > 2 &&
    adminName.trim().length > 2 &&
    /\S+@\S+\.\S+/.test(adminEmail);

  const submit = () => {
    if (!valid) return;
    createBranch({
      name: name.trim(),
      shortName: shortName.trim(),
      code: code.trim() || '—',
      city: city.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      adminName: adminName.trim(),
      adminEmail: adminEmail.trim().toLowerCase(),
    });
    toast.success(`${shortName.trim()} opened`, {
      description: `${adminName.trim()} can sign in with ${adminEmail.trim().toLowerCase()} and the password Branch@123.`,
    });
    setName('');
    setShortName('');
    setAdminName('');
    setAdminEmail('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open a branch"
      description="The branch and its administrator are created together — a school with nobody able to sign in is of no use."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Open branch
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="School name" required htmlFor="bn">
          <Input
            id="bn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sri Vidya Mandir Matriculation School, Pollachi"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Short name" required htmlFor="bsn">
            <Input
              id="bsn"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Sri Vidya Mandir — Pollachi"
            />
          </Field>
          <Field label="Recognition code" htmlFor="bc" hint="As issued by the DSE.">
            <Input id="bc" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Address" htmlFor="ba">
            <Input id="ba" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="Town" htmlFor="bt">
            <Input id="bt" value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone" htmlFor="bp">
            <Input id="bp" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Office email" htmlFor="be">
            <Input id="be" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>

        <div className="border-t border-line pt-4">
          <p className="mb-3 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
            Branch administrator
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required htmlFor="ban">
              <Input
                id="ban"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Mr. S. Elangovan"
              />
            </Field>
            <Field label="Email" required htmlFor="bae">
              <Input
                id="bae"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="pollachi@srividyamandir.edu.in"
              />
            </Field>
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">
            They are appointed Correspondent of the new branch and asked to change the temporary
            password on first sign-in.
          </p>
        </div>
      </div>
    </Modal>
  );
}
