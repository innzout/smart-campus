import { useState } from 'react';
import { toast } from 'sonner';
import {
  BadgeCheck,
  CheckCircle2,
  FileText,
  Paperclip,
  Clock,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useCan, useCurrentUser } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { missingDocuments, pendingApplications, userById } from '@/lib/queries';
import {
  attachDocument,
  reviewApplication,
  submitApplication,
  verifyDocument,
} from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { formatDate, relativeTime } from '@/lib/utils';
import { DESIGNATION_LABEL, DOCUMENT_LABEL } from '@/data/types';
import type { ApplicationStatus, Designation, DocumentKind, StaffApplication } from '@/data/types';

/**
 * Staff recruitment — application, documents, then the Principal's decision.
 *
 * Approval is the act that creates the account. Until a file is approved the
 * applicant has no way into the system, which is how a school expects it to
 * work: the Principal or Correspondent appoints, and the software follows.
 */

const STATUS: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'info' },
  'under-review': { label: 'Under review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'good' },
  rejected: { label: 'Not appointed', tone: 'critical' },
};

const TEACHING: Designation[] = ['assistant-professor', 'assistant-professor', 'associate-professor', 'physical-director'];

const POSTS: Designation[] = [
  'assistant-professor',
  'assistant-professor',
  'associate-professor',
  'physical-director',
  'librarian',
  'lab-instructor',
  'office-superintendent',
  'accounts-officer',
];

export default function Recruitment() {
  const db = useDatabase();
  const can = useCan();
  const me = useCurrentUser();
  const review = can('recruitment.review');

  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [openId, setOpenId] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const pending = pendingApplications(db);
  const list = filter === 'pending' ? pending : db.applications;
  const active = db.applications.find((a) => a.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Staff recruitment"
        subtitle="Applications, documents and appointment. Approving a file creates the staff account."
        action={
          <>
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'pending', label: `Pending (${pending.length})` },
                { value: 'all', label: 'All' },
              ]}
            />
            <Button
              variant="secondary"
              icon={<UserPlus className="size-4" />}
              onClick={() => setApplyOpen(true)}
            >
              Enter an application
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Awaiting a decision"
          value={pending.length}
          note="Submitted or under review"
          icon={Clock}
          tone={pending.length ? 'warning' : 'good'}
        />
        <StatTile
          label="Appointed this year"
          value={db.applications.filter((a) => a.status === 'approved').length}
          note="Accounts created on approval"
          icon={BadgeCheck}
          tone="good"
          delay={0.06}
        />
        <StatTile
          label="Files incomplete"
          value={pending.filter((a) => missingDocuments(a).length > 0).length}
          note="Documents still to come"
          icon={Paperclip}
          delay={0.12}
        />
        <StatTile
          label="Staff on roll"
          value={db.users.filter((u) => !!u.employeeId).length}
          note="Teaching and non-teaching"
          icon={Users}
          delay={0.18}
        />
      </StatGrid>

      <MotionCard delay={0.1}>
        <CardHeader
          title={filter === 'pending' ? 'Applications awaiting a decision' : 'All applications'}
          subtitle="Open a file to check the documents and record a decision"
        />
        <CardBody className="pt-4">
          {list.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-6" />}
              title="Nothing waiting"
              description="Every application has been decided. New ones will appear here."
            />
          ) : (
            <ul className="space-y-2">
              {list.map((app) => {
                const missing = missingDocuments(app);
                const status = STATUS[app.status];
                return (
                  <li key={app.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(app.id)}
                      className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-hover"
                    >
                      <Avatar name={app.name} hue={(app.name.length * 37) % 360} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {app.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                          {DESIGNATION_LABEL[app.designation]} · {app.qualification} ·{' '}
                          {app.experienceYears} yr experience · {app.ref}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        {app.netCleared ? <Badge tone="good">TET cleared</Badge> : null}
                        {missing.length > 0 ? (
                          <Badge tone="warning">{missing.length} document{missing.length === 1 ? '' : 's'} missing</Badge>
                        ) : (
                          <Badge tone="neutral">File complete</Badge>
                        )}
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <span className="text-[12px] text-ink-3 tnum">
                          {relativeTime(app.submittedOn)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </MotionCard>

      {active ? (
        <ApplicationDialog
          app={active}
          canReview={review}
          reviewerId={me.id}
          onClose={() => setOpenId(null)}
        />
      ) : null}
      <ApplyDialog open={applyOpen} onClose={() => setApplyOpen(false)} />
    </>
  );
}

/* ── the file, its documents, and the decision ────────────────────────── */

function ApplicationDialog({
  app,
  canReview,
  reviewerId,
  onClose,
}: {
  app: StaffApplication;
  canReview: boolean;
  reviewerId: string;
  onClose: () => void;
}) {
  const db = useDatabase();
  const [note, setNote] = useState(app.reviewNote);
  const missing = missingDocuments(app);
  const decided = app.status === 'approved' || app.status === 'rejected';
  const reviewer = userById(db, app.reviewedById);

  const decide = (status: 'under-review' | 'approved' | 'rejected') => {
    reviewApplication({ applicationId: app.id, status, note, reviewedById: reviewerId });
    toast.success(
      status === 'approved'
        ? `${app.name} appointed`
        : status === 'rejected'
          ? 'Application closed'
          : 'Marked under review',
      {
        description:
          status === 'approved'
            ? 'A staff account has been created. The temporary password is Welcome@123.'
            : undefined,
      },
    );
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={app.name}
      description={`${DESIGNATION_LABEL[app.designation]} · ${app.ref} · applied ${formatDate(app.submittedOn)}`}
      size="lg"
      footer={
        canReview && !decided ? (
          <>
            <Button variant="secondary" onClick={() => decide('under-review')}>
              Mark under review
            </Button>
            <Button
              variant="danger"
              icon={<XCircle className="size-4" />}
              onClick={() => decide('rejected')}
            >
              Not appointed
            </Button>
            <Button
              icon={<CheckCircle2 className="size-4" />}
              disabled={missing.length > 0}
              onClick={() => decide('approved')}
            >
              Approve and create account
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-surface-2 px-4 py-3.5 text-[12.5px] sm:grid-cols-3">
          {[
            ['Post applied for', DESIGNATION_LABEL[app.designation]],
            ['Qualification', app.qualification],
            ['Experience', `${app.experienceYears} years`],
            ['TET', app.netCleared ? 'Cleared' : 'Not cleared'],
            ['Phone', app.phone],
            ['Email', app.email],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-ink-3">{label}</dt>
              <dd className="mt-0.5 font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {app.courseIds.length > 0 ? (
          <div>
            <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
              Can teach
            </p>
            <div className="flex flex-wrap gap-1.5">
              {app.courseIds.map((id) => (
                <Badge key={id} tone="brand">
                  {db.courses.find((c) => c.id === id)?.title ?? id}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── documents ── */}
        <div>
          <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
            Documents
            <span className="ml-1.5 font-normal tracking-normal normal-case">
              {missing.length === 0
                ? '· file complete'
                : `· ${missing.length} still required`}
            </span>
          </p>
          <ul className="space-y-1.5">
            {app.documents.map((doc) => (
              <li
                key={doc.kind}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2"
              >
                <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {DOCUMENT_LABEL[doc.kind]}
                  </span>
                  <span className="block truncate text-[11.5px] text-ink-3">
                    {doc.fileName} · uploaded {formatDate(doc.uploadedOn)}
                  </span>
                </span>
                {canReview && !decided ? (
                  <Checkbox
                    label="Verified"
                    checked={doc.verified}
                    onChange={(e) => verifyDocument(app.id, doc.kind, e.target.checked)}
                  />
                ) : doc.verified ? (
                  <Badge tone="good" icon={<CheckCircle2 className="size-3" />}>
                    Verified
                  </Badge>
                ) : (
                  <Badge tone="neutral">Not checked</Badge>
                )}
              </li>
            ))}

            {missing.map((kind) => (
              <li
                key={kind}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-line px-3 py-2"
              >
                <Paperclip className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1 text-[13px] text-ink-3">
                  {DOCUMENT_LABEL[kind as DocumentKind]} — not received
                </span>
                {canReview && !decided ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      attachDocument(app.id, kind as DocumentKind, `${kind}-${app.name.split(' ').at(-1)?.toLowerCase()}.pdf`);
                      toast.success(`${DOCUMENT_LABEL[kind as DocumentKind]} recorded as received`);
                    }}
                  >
                    Record as received
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {/* Said plainly rather than implied, because a school will ask. */}
          <p className="mt-2 text-[11.5px] text-ink-3">
            This prototype records that a document was received, not the file itself — nine scans
            per applicant will not fit in a browser. File storage is part of the server work.
          </p>
        </div>

        {canReview && !decided ? (
          <Field label="Remarks" htmlFor="note" hint="Recorded against the file with your name.">
            <Textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Demonstration class satisfactory. References checked."
            />
          </Field>
        ) : app.reviewNote ? (
          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <p className="text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
              Decision
            </p>
            <p className="mt-1 text-[13px] text-ink-2">{app.reviewNote}</p>
            <p className="mt-1.5 text-[11.5px] text-ink-3">
              {reviewer?.name ?? 'The office'}
              {app.reviewedOn ? ` · ${formatDate(app.reviewedOn)}` : ''}
            </p>
          </div>
        ) : null}

        {canReview && !decided && missing.length > 0 ? (
          <p className="text-[12.5px] text-[--color-warning]">
            The file cannot be approved until every required document is on it.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/* ── entering an application at the office counter ────────────────────── */

function ApplyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDatabase();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState<Designation>('assistant-professor');
  const [qualification, setQualification] = useState('');
  const [netCleared, setTetCleared] = useState(false);
  const [experienceYears, setExperienceYears] = useState(0);
  const [courseIds, setCourseIds] = useState<string[]>([]);

  const teaching = TEACHING.includes(designation);
  const [departmentId, setDepartmentId] = useState(db.departments[0]?.id ?? '');
  const [publications, setPublications] = useState(0);
  // Which papers an applicant can be offered follows from the department they
  // are applying to, since a college hires against a department.
  const programmeIds = new Set(
    db.programmes.filter((pr) => pr.departmentId === departmentId).map((pr) => pr.id),
  );
  const offerable = db.courses.filter((c) => programmeIds.has(c.programmeId));

  const valid = name.trim().length > 2 && /\S+@\S+\.\S+/.test(email) && qualification.trim();

  const submit = () => {
    if (!valid) return;
    submitApplication({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      designation,
      qualification: qualification.trim(),
      netCleared,
      phd: qualification.includes('Ph.D.'),
      departmentId,
      publications,
      experienceYears,
      courseIds: teaching ? courseIds : [],
    });
    toast.success('Application recorded', {
      description: 'The Principal has been notified. Attach documents from the file.',
    });
    setName('');
    setEmail('');
    setPhone('');
    setQualification('');
    setCourseIds([] as string[]);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enter an application"
      description="Particulars as given on the application form. Documents are attached afterwards."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Record application
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name" required htmlFor="an">
          <Input id="an" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mrs. K. Sumathi" />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" required htmlFor="ae">
            <Input id="ae" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="ap">
            <Input id="ap" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98430 00000" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Post applied for"
            required
            htmlFor="ad"
            hint={
              designation === 'assistant-professor'
                ? 'Entry grade; NET or a doctorate is expected'
                : designation === 'associate-professor'
                  ? 'Requires a doctorate and a publication record'
                  : designation === 'professor'
                    ? 'Senior-most teaching post'
                    : undefined
            }
          >
            <Select
              id="ad"
              value={designation}
              onChange={(e) => {
                setDesignation(e.target.value as Designation);
                setCourseIds([] as string[]);
              }}
            >
              {POSTS.map((d) => (
                <option key={d} value={d}>
                  {DESIGNATION_LABEL[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department" required htmlFor="adep">
            <Select
              id="adep"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setCourseIds([] as string[]);
              }}
            >
              {db.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Publications" htmlFor="apub" hint="Papers in refereed journals.">
            <Input
              id="apub"
              type="number"
              min={0}
              max={200}
              value={publications}
              onChange={(e) => setPublications(Number(e.target.value))}
            />
          </Field>
          <Field label="Experience (years)" htmlFor="ax">
            <Input
              id="ax"
              type="number"
              min={0}
              max={40}
              value={experienceYears}
              onChange={(e) => setExperienceYears(Number(e.target.value))}
            />
          </Field>
        </div>

        <Field label="Qualification" required htmlFor="aq">
          <Input
            id="aq"
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            placeholder="B.Sc. (Maths), B.Ed."
          />
        </Field>

        {teaching ? (
          <>
            <Checkbox
              label="Teacher Eligibility Test cleared"
              checked={netCleared}
              onChange={(e) => setTetCleared(e.target.checked)}
            />
            <Field label="Subjects they can teach" htmlFor="as">
              <div className="flex flex-wrap gap-1.5">
                {offerable.map((s) => {
                  const on = courseIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setCourseIds((prev) =>
                          on ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                        )
                      }
                      className={
                        on
                          ? 'rounded-lg border border-brand-500/50 bg-brand-500/12 px-2.5 py-1.5 text-[12.5px] font-medium text-brand-600 dark:text-brand-300'
                          : 'rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink-2 hover:border-line-strong hover:text-ink'
                      }
                    >
                      {s.title}
                    </button>
                  );
                })}
              </div>
            </Field>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
