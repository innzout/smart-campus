import { useState } from 'react';
import { toast } from 'sonner';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  IndianRupee,
  Plus,
  TrendingUp,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useAuth, useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  academicStanding,
  applicationsFor,
  driveRoster,
  eligibilityFor,
  placementSummary,
  sectionLabel,
} from '@/lib/queries';
import { addCompany, advanceDriveApplication, applyToDrive, createDrive } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { BarList } from '@/components/charts/Charts';
import { cn, formatDate, relativeDay, todayISO } from '@/lib/utils';
import type { Drive, DriveStage, User } from '@/data/types';

/**
 * The placement cell.
 *
 * For a final-year student and for the parent paying the fees, this is the part
 * of a college that justifies the rest of it. The thing it has to get right is
 * eligibility: a recruiter's CGPA and arrear bar is a condition of registering,
 * not something discovered at the interview, so a student who cannot apply is
 * told exactly why.
 */

const STAGE_TONE: Record<DriveStage, Tone> = {
  applied: 'neutral',
  shortlisted: 'info',
  aptitude: 'info',
  technical: 'warning',
  hr: 'warning',
  selected: 'good',
  rejected: 'critical',
};

const STAGE_LABEL: Record<DriveStage, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  aptitude: 'Aptitude round',
  technical: 'Technical round',
  hr: 'HR round',
  selected: 'Selected',
  rejected: 'Not selected',
};

const STATUS_TONE: Record<Drive['status'], Tone> = {
  announced: 'neutral',
  'registration-open': 'good',
  'in-progress': 'warning',
  completed: 'info',
  cancelled: 'critical',
};

/* ── what a student or parent sees ────────────────────────────────────── */

function StudentPlacements({ student, canApply }: { student: User; canApply: boolean }) {
  const db = useDatabase();
  const standing = academicStanding(db, student.id);
  const mine = applicationsFor(db, student.id);
  const offers = mine.filter((m) => m.application.stage === 'selected');
  const applied = new Set(mine.map((m) => m.application.driveId));

  const open = db.drives.filter(
    (d) => d.status === 'registration-open' || d.status === 'announced',
  );

  return (
    <>
      <PageHeader
        title="Placements"
        subtitle={`${student.name} · ${sectionLabel(db, student.sectionId)} · CGPA ${standing.cgpa.toFixed(2)} · ${standing.arrears} arrear${standing.arrears === 1 ? '' : 's'}`}
      />

      <StatGrid>
        <StatTile
          label="Offers in hand"
          value={offers.length}
          note={
            offers[0]
              ? `${offers[0].company?.name} — ₹${offers[0].drive?.packageLpa} LPA`
              : 'None yet'
          }
          icon={Briefcase}
          tone={offers.length ? 'good' : 'neutral'}
        />
        <StatTile
          label="Applications"
          value={mine.length}
          note="Across all drives"
          icon={Users}
          delay={0.06}
        />
        <StatTile
          label="CGPA"
          value={standing.cgpa.toFixed(2)}
          note="Most recruiters ask for 6.0 or better"
          icon={TrendingUp}
          tone={standing.cgpa >= 7 ? 'good' : standing.cgpa >= 6 ? 'warning' : 'critical'}
          delay={0.12}
        />
        <StatTile
          label="Arrears"
          value={standing.arrears}
          note={standing.arrears ? 'Most recruiters allow none' : 'Nothing standing'}
          icon={standing.arrears ? TriangleAlert : CheckCircle2}
          tone={standing.arrears ? 'critical' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      {offers.length > 0 ? (
        <MotionCard delay={0.08} className="mb-5">
          <CardHeader title="Offers" subtitle="Congratulations" />
          <CardBody className="space-y-2 pt-4">
            {offers.map(({ application, drive, company }) => (
              <div
                key={application.id}
                className="rounded-xl border border-[--color-good]/35 bg-[--color-good]/[0.05] px-4 py-3.5"
              >
                <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
                  <Building2 className="size-4 shrink-0 text-[--color-good]" aria-hidden />
                  {company?.name}
                  <Badge tone="good">Selected</Badge>
                </p>
                <p className="mt-1 text-[12.5px] text-ink-2">
                  {drive?.role} · ₹{drive?.packageLpa} LPA · {drive?.location}
                </p>
                {application.note ? (
                  <p className="mt-1 text-[12px] text-ink-3">{application.note}</p>
                ) : null}
              </div>
            ))}
          </CardBody>
        </MotionCard>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <MotionCard delay={0.1}>
          <CardHeader title="Open drives" subtitle="Whether you may register, and why" />
          <CardBody className="pt-4">
            {open.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="size-6" />}
                title="No drives open"
                description="Drives appear here as the placement cell announces them."
              />
            ) : (
              <ul className="space-y-2.5">
                {open.map((drive) => {
                  const company = db.companies.find((c) => c.id === drive.companyId);
                  const check = eligibilityFor(db, student.id, drive);
                  const already = applied.has(drive.id);
                  return (
                    <li
                      key={drive.id}
                      className={cn(
                        'rounded-xl border px-3.5 py-3',
                        check.eligible ? 'border-line' : 'border-line bg-surface-2/50',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-ink">
                            {company?.name} — {drive.role}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                            ₹{drive.packageLpa} LPA · {drive.location} · drive{' '}
                            {relativeDay(drive.driveOn)}
                          </span>
                        </span>
                        <Badge tone={STATUS_TONE[drive.status]}>
                          {drive.status.replace('-', ' ')}
                        </Badge>
                      </div>

                      <p className="mt-2 text-[11.5px] text-ink-3">
                        Requires CGPA {drive.minCgpa.toFixed(1)}
                        {drive.maxArrears === 0
                          ? ' and no standing arrears'
                          : ` and at most ${drive.maxArrears} arrears`}
                        . Rounds: {drive.rounds.join(' → ')}.
                      </p>

                      {already ? (
                        <Badge tone="info" className="mt-2">
                          Registered
                        </Badge>
                      ) : check.eligible ? (
                        canApply ? (
                          <Button
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              applyToDrive(drive.id, student.id);
                              toast.success(`Registered for ${company?.name}`, {
                                description: 'The placement cell will publish the shortlist.',
                              });
                            }}
                          >
                            Register
                          </Button>
                        ) : (
                          <Badge tone="good" className="mt-2">
                            Eligible — the student may register
                          </Badge>
                        )
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {check.reasons.map((r) => (
                            <li
                              key={r}
                              className="flex items-start gap-1.5 text-[11.5px] text-[--color-critical]"
                            >
                              <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden />
                              {r}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.16}>
          <CardHeader title="Your applications" subtitle="Where each one stands" />
          <CardBody className="pt-4">
            {mine.length === 0 ? (
              <EmptyState
                icon={<Users className="size-6" />}
                title="No applications yet"
                description="Register for an open drive to appear here."
              />
            ) : (
              <ul className="space-y-2">
                {mine.map(({ application, drive, company }) => (
                  <li
                    key={application.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {company?.name}
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-3">
                        {drive?.role} · applied {formatDate(application.appliedOn)}
                      </span>
                    </span>
                    <Badge tone={STAGE_TONE[application.stage]}>
                      {STAGE_LABEL[application.stage]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </MotionCard>
      </div>
    </>
  );
}

/* ── the placement cell ───────────────────────────────────────────────── */

function PlacementCell() {
  const db = useDatabase();
  const can = useCan();
  const manage = can('placement.manage');
  const summary = placementSummary(db);

  const [tab, setTab] = useState<'drives' | 'recruiters'>('drives');
  const [openDrive, setOpenDrive] = useState<string | null>(null);
  const [newDrive, setNewDrive] = useState(false);
  const [newCompany, setNewCompany] = useState(false);

  const byCompany = db.companies
    .map((company) => {
      const drives = db.drives.filter((d) => d.companyId === company.id);
      const offers = db.driveApplications.filter(
        (a) => a.stage === 'selected' && drives.some((d) => d.id === a.driveId),
      ).length;
      return { name: company.name, value: offers, meta: `${drives.length} drives` };
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader
        title="Placements"
        subtitle={`${summary.companies} recruiters · ${summary.drives} drives · ${summary.offers} offers made`}
        action={
          <>
            <Segmented
              size="sm"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'drives', label: 'Drives' },
                { value: 'recruiters', label: 'Recruiters' },
              ]}
            />
            {manage ? (
              <>
                <Button
                  variant="secondary"
                  icon={<Building2 className="size-4" />}
                  onClick={() => setNewCompany(true)}
                >
                  Add recruiter
                </Button>
                <Button icon={<Plus className="size-4" />} onClick={() => setNewDrive(true)}>
                  Announce a drive
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Placed"
          value={`${summary.percent}%`}
          note={`${summary.placed} of ${summary.eligible} final-year students`}
          icon={Briefcase}
          tone={summary.percent >= 50 ? 'good' : 'warning'}
        />
        <StatTile
          label="Offers made"
          value={summary.offers}
          note={`${summary.applications} applications across all drives`}
          icon={CheckCircle2}
          delay={0.06}
        />
        <StatTile
          label="Highest package"
          value={`₹${summary.highest} LPA`}
          note={`Average ₹${summary.average.toFixed(1)} LPA`}
          icon={IndianRupee}
          tone="good"
          delay={0.12}
        />
        <StatTile
          label="Recruiters"
          value={summary.companies}
          note={`${db.drives.filter((d) => d.status === 'registration-open').length} drives open`}
          icon={Building2}
          delay={0.18}
        />
      </StatGrid>

      {tab === 'drives' ? (
        <MotionCard delay={0.1}>
          <CardHeader title="Drives" subtitle="Open one to work through the candidates" />
          <CardBody className="pt-4">
            <ul className="space-y-2">
              {db.drives.map((drive) => {
                const company = db.companies.find((c) => c.id === drive.companyId);
                const roster = driveRoster(db, drive.id);
                const selected = roster.filter((r) => r.application.stage === 'selected').length;
                return (
                  <li key={drive.id}>
                    <button
                      type="button"
                      onClick={() => setOpenDrive(drive.id)}
                      className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {company?.name} — {drive.role}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                          ₹{drive.packageLpa} LPA · {drive.location} · CGPA {drive.minCgpa}+ ·{' '}
                          {drive.maxArrears === 0 ? 'no arrears' : `≤${drive.maxArrears} arrears`} ·
                          drive {formatDate(drive.driveOn)}
                        </span>
                      </span>
                      <Badge tone="neutral">{roster.length} applied</Badge>
                      {selected > 0 ? <Badge tone="good">{selected} selected</Badge> : null}
                      <Badge tone={STATUS_TONE[drive.status]}>
                        {drive.status.replace('-', ' ')}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </MotionCard>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <MotionCard delay={0.1}>
            <CardHeader title="Recruiters" subtitle="Who comes to campus" />
            <CardBody className="pt-4">
              <ul className="space-y-2">
                {db.companies.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">
                        {c.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                        {c.sector} · {c.contactName} · {c.contactEmail}
                      </span>
                    </span>
                    <Badge tone="neutral">
                      {db.drives.filter((d) => d.companyId === c.id).length} drives
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </MotionCard>

          <MotionCard delay={0.16}>
            <CardHeader title="Offers by recruiter" subtitle="Who actually hires" />
            <CardBody className="pt-2">
              {byCompany.length === 0 ? (
                <EmptyState icon={<Briefcase className="size-6" />} title="No offers yet" />
              ) : (
                <BarList data={byCompany} valueLabel="Offers" height={240} />
              )}
            </CardBody>
          </MotionCard>
        </div>
      )}

      {openDrive ? (
        <DriveDialog driveId={openDrive} canManage={manage} onClose={() => setOpenDrive(null)} />
      ) : null}
      {newDrive ? <NewDriveDialog onClose={() => setNewDrive(false)} /> : null}
      {newCompany ? <NewCompanyDialog onClose={() => setNewCompany(false)} /> : null}
    </>
  );
}

function DriveDialog({
  driveId,
  canManage,
  onClose,
}: {
  driveId: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const db = useDatabase();
  const drive = db.drives.find((d) => d.id === driveId);
  const company = db.companies.find((c) => c.id === drive?.companyId);
  const roster = driveRoster(db, driveId);

  if (!drive) return null;

  const stages: DriveStage[] = ['applied', 'shortlisted', 'technical', 'hr', 'selected', 'rejected'];

  return (
    <Modal
      open
      onClose={onClose}
      title={`${company?.name} — ${drive.role}`}
      description={`₹${drive.packageLpa} LPA · ${drive.location} · CGPA ${drive.minCgpa}+ · ${drive.maxArrears === 0 ? 'no arrears' : `at most ${drive.maxArrears} arrears`}`}
      size="lg"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {roster.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="Nobody has registered"
          description="Eligible students see this drive on their own Placements page."
        />
      ) : (
        <ul className="space-y-1.5">
          {roster.map(({ application, student, section, standing }) => (
            <li
              key={application.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2"
            >
              <Avatar name={student!.name} hue={student!.avatarHue} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {student!.name}
                </span>
                <span className="block truncate text-[11px] text-ink-3">
                  {student!.registerNo} · {section?.label} · CGPA {standing.cgpa.toFixed(2)}
                  {standing.arrears ? ` · ${standing.arrears} arrears` : ''}
                </span>
              </span>
              {canManage ? (
                <Select
                  aria-label={`Stage for ${student!.name}`}
                  value={application.stage}
                  className="h-8 w-40 text-[12px]"
                  onChange={(e) => {
                    advanceDriveApplication(application.id, e.target.value as DriveStage);
                    toast.success(`${student!.name}: ${STAGE_LABEL[e.target.value as DriveStage]}`);
                  }}
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </Select>
              ) : (
                <Badge tone={STAGE_TONE[application.stage]}>
                  {STAGE_LABEL[application.stage]}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function NewDriveDialog({ onClose }: { onClose: () => void }) {
  const db = useDatabase();
  const [companyId, setCompanyId] = useState(db.companies[0]?.id ?? '');
  const [role, setRole] = useState('');
  const [packageLpa, setPackageLpa] = useState(4);
  const [location, setLocation] = useState('Coimbatore');
  const [minCgpa, setMinCgpa] = useState(6);
  const [maxArrears, setMaxArrears] = useState(0);
  const [programmeIds, setProgrammeIds] = useState<string[]>([]);
  const [driveOn, setDriveOn] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().slice(0, 10);
  });
  const [registrationCloses, setRegistrationCloses] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });

  const valid = role.trim().length > 2 && companyId && programmeIds.length > 0;

  // How many students the bar actually admits, before it is announced.
  const eligibleCount = db.users.filter((u) => {
    if (!u.roles.includes('student') || !programmeIds.includes(u.programmeId ?? '')) return false;
    const standing = academicStanding(db, u.id);
    return standing.cgpa >= minCgpa && standing.arrears <= maxArrears;
  }).length;

  return (
    <Modal
      open
      onClose={onClose}
      title="Announce a drive"
      description="Only students who meet the bar are notified — telling the rest is noise, not news."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              createDrive({
                companyId,
                role: role.trim(),
                packageLpa,
                location: location.trim(),
                programmeIds,
                minCgpa,
                maxArrears,
                driveOn,
                registrationCloses,
                rounds: ['Aptitude', 'Technical', 'HR'],
              });
              toast.success('Drive announced', {
                description: `${eligibleCount} eligible students have been notified.`,
              });
              onClose();
            }}
          >
            Announce
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Recruiter" required htmlFor="dc">
            <Select id="dc" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {db.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Role" required htmlFor="dr">
            <Input
              id="dr"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Programmer Analyst Trainee"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Package (₹ LPA)" htmlFor="dp">
            <Input
              id="dp"
              type="number"
              min={1}
              step={0.5}
              value={packageLpa}
              onChange={(e) => setPackageLpa(Number(e.target.value))}
            />
          </Field>
          <Field label="Location" htmlFor="dl">
            <Input id="dl" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>

        <Field
          label="Open to"
          required
          htmlFor="dpr"
          hint={`${eligibleCount} students currently meet the bar.`}
        >
          <div className="flex flex-wrap gap-1.5">
            {db.programmes.map((p) => {
              const on = programmeIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setProgrammeIds((prev) =>
                      on ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                    )
                  }
                  className={
                    on
                      ? 'rounded-lg border border-brand-500/50 bg-brand-500/12 px-2.5 py-1.5 text-[12.5px] font-medium text-brand-600 dark:text-brand-300'
                      : 'rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink-2 hover:border-line-strong hover:text-ink'
                  }
                >
                  {p.shortName}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Minimum CGPA" htmlFor="dcg">
            <Input
              id="dcg"
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={minCgpa}
              onChange={(e) => setMinCgpa(Number(e.target.value))}
            />
          </Field>
          <Field label="Arrears allowed" htmlFor="da">
            <Input
              id="da"
              type="number"
              min={0}
              max={10}
              value={maxArrears}
              onChange={(e) => setMaxArrears(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Registration closes" htmlFor="drc">
            <Input
              id="drc"
              type="date"
              min={todayISO()}
              value={registrationCloses}
              onChange={(e) => setRegistrationCloses(e.target.value)}
            />
          </Field>
          <Field label="Drive date" htmlFor="ddo">
            <Input
              id="ddo"
              type="date"
              min={registrationCloses}
              value={driveOn}
              onChange={(e) => setDriveOn(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function NewCompanyDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [website, setWebsite] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const valid = name.trim().length > 1 && sector.trim().length > 1;

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a recruiter"
      description="Kept so drives can be announced against them and offers tracked."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              addCompany({
                name: name.trim(),
                sector: sector.trim(),
                website: website.trim(),
                contactName: contactName.trim(),
                contactEmail: contactEmail.trim(),
              });
              toast.success(`${name.trim()} added`);
              onClose();
            }}
          >
            Add recruiter
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required htmlFor="cn">
          <Input id="cn" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sector" required htmlFor="cse">
            <Input
              id="cse"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="IT Services"
            />
          </Field>
          <Field label="Website" htmlFor="cw">
            <Input id="cw" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact" htmlFor="ccn">
            <Input id="ccn" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="cce">
            <Input
              id="cce"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export default function Placements() {
  const user = useCurrentUser();
  const { subject } = useAuth();
  const can = useCan();

  if (user.roles.includes('parent') || user.roles.includes('student')) {
    if (!subject) {
      return (
        <EmptyState
          icon={<Briefcase className="size-6" />}
          title="No student linked to this account"
          description="Please contact the college office."
        />
      );
    }
    // A parent watches; only the student registers.
    return <StudentPlacements student={subject} canApply={can('placement.apply')} />;
  }

  return <PlacementCell />;
}
