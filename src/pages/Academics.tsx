import { useState } from 'react';
import { toast } from 'sonner';
import {
  BookOpen,
  BookPlus,
  Building2,
  FlaskConical,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  TriangleAlert,
  UserCog,
} from 'lucide-react';
import { useCan } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  courseById,
  coursesOfProgramme,
  departmentById,
  eligibleFaculty,
  offeringsOf,
  programmeById,
  programmesByDepartment,
  sectionById,
  sectionsOfProgramme,
  studentsInSection,
  userById,
} from '@/lib/queries';
import {
  assignOffering,
  createCourse,
  createSection,
  removeOffering,
  updateSection,
} from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { cn, num } from '@/lib/utils';
import { COURSE_KIND_LABEL, DESIGNATION_LABEL, LEVEL_LABEL } from '@/data/types';
import type { CourseKind, Section } from '@/data/types';

/**
 * Academic setup — the structure the rest of the college hangs off.
 *
 * A college is departments, each running programmes, each admitting a batch
 * that moves through semesters as a cohort. What a cohort studies is the set of
 * papers its programme prescribes for the semester it has reached, so a paper
 * belongs to a programme and a semester, and an offering is a paper handed to a
 * named member of staff for one cohort.
 */
export default function Academics() {
  const db = useDatabase();
  const can = useCan();
  const manage = can('academic.manage');

  const tree = programmesByDepartment(db);
  const [selectedId, setSelectedId] = useState<string>(() => db.sections[0]?.id ?? '');
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addPaperOpen, setAddPaperOpen] = useState(false);
  const [newCourseOpen, setNewCourseOpen] = useState(false);

  const section = sectionById(db, selectedId);
  const programme = programmeById(db, section?.programmeId);
  const offered = section ? offeringsOf(db, section.id) : [];

  const unstaffed = db.offerings.filter((o) => !db.users.some((u) => u.id === o.facultyId)).length;

  return (
    <>
      <PageHeader
        title="Academic setup"
        subtitle={`${db.departments.length} departments · ${db.programmes.length} programmes · ${db.sections.length} cohorts · ${db.courses.length} papers in the syllabus`}
        action={
          manage ? (
            <>
              <Button
                variant="secondary"
                icon={<BookPlus className="size-4" />}
                onClick={() => setNewCourseOpen(true)}
              >
                Add a paper
              </Button>
              <Button icon={<Plus className="size-4" />} onClick={() => setNewSectionOpen(true)}>
                New cohort
              </Button>
            </>
          ) : null
        }
      />

      <StatGrid>
        <StatTile
          label="Programmes"
          value={db.programmes.length}
          note="Undergraduate and postgraduate"
          icon={GraduationCap}
        />
        <StatTile
          label="Students"
          value={num(db.users.filter((u) => u.roles.includes('student')).length)}
          note={`Across ${db.sections.length} cohorts`}
          icon={Layers}
          delay={0.06}
        />
        <StatTile
          label="Papers offered"
          value={db.offerings.length}
          note="Paper–cohort–faculty links this semester"
          icon={BookOpen}
          delay={0.12}
        />
        <StatTile
          label="Without faculty"
          value={unstaffed}
          note={unstaffed ? 'Needs assigning' : 'Every paper is staffed'}
          icon={unstaffed ? TriangleAlert : UserCog}
          tone={unstaffed ? 'critical' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,21rem)_1fr]">
        {/* ── departments, programmes, cohorts ── */}
        <MotionCard delay={0.1}>
          <CardHeader title="Cohorts" subtitle="By department and programme" />
          <CardBody className="space-y-4 pt-4">
            {tree.map(({ department, hod, programmes }) => (
              <div key={department.id}>
                <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
                  <Building2 className="size-3.5" aria-hidden />
                  {department.name}
                </p>
                {hod ? <p className="mb-2 text-[11.5px] text-ink-3">Head: {hod.name}</p> : null}

                <div className="space-y-2">
                  {programmes.map((prog) => {
                    const cohorts = sectionsOfProgramme(db, prog.id);
                    return (
                      <div key={prog.id} className="rounded-xl bg-surface-2 px-3 py-2.5">
                        <p className="text-[12.5px] font-semibold text-ink">
                          {prog.shortName}
                          <span className="ml-1.5 font-normal text-ink-3">
                            {LEVEL_LABEL[prog.level]} · {prog.semesters} semesters
                          </span>
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {cohorts.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setSelectedId(c.id)}
                              className={cn(
                                'rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors',
                                c.id === selectedId
                                  ? 'border-brand-500/50 bg-brand-500/12 text-brand-600 dark:text-brand-300'
                                  : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
                              )}
                            >
                              Sem {c.semester}
                              <span className="ml-1 opacity-70">({c.batch})</span>
                            </button>
                          ))}
                          {cohorts.length === 0 ? (
                            <span className="text-[11.5px] text-ink-3">No cohort on roll</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardBody>
        </MotionCard>

        {/* ── the selected cohort's papers ── */}
        <MotionCard delay={0.16}>
          {section && programme ? (
            <>
              <CardHeader
                title={`${section.label} — semester ${section.semester}`}
                subtitle={[
                  programme.name,
                  `batch ${section.batch}`,
                  section.room,
                  `${studentsInSection(db, section.id).length} on roll`,
                  `tutor ${userById(db, section.tutorId)?.name ?? '—'}`,
                ].join(' · ')}
                action={
                  manage ? (
                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Pencil className="size-3.5" />}
                        onClick={() => setEditOpen(true)}
                      >
                        Edit cohort
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Plus className="size-3.5" />}
                        onClick={() => setAddPaperOpen(true)}
                      >
                        Add paper
                      </Button>
                    </span>
                  ) : null
                }
              />
              <CardBody className="pt-4">
                {offered.length === 0 ? (
                  <EmptyState
                    icon={<BookOpen className="size-6" />}
                    title="No papers assigned yet"
                    description="Add the papers this cohort studies and name the member of staff for each."
                  />
                ) : (
                  <ul className="space-y-2">
                    {offered.map((offering) => {
                      const course = courseById(db, offering.courseId);
                      const faculty = userById(db, offering.facultyId);
                      const pool = eligibleFaculty(db, offering.courseId);
                      // Teaching a postgraduate paper without a doctorate or
                      // NET is a university condition, not a preference.
                      const mismatched = !!faculty && !pool.some((f) => f.id === faculty.id);

                      return (
                        <li
                          key={offering.id}
                          className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-[13.5px] font-semibold text-ink">
                                {course?.title ?? 'Unknown paper'}
                              </span>
                              {course?.kind === 'practical' ? (
                                <Badge tone="info" icon={<FlaskConical className="size-3" />}>
                                  Practical
                                </Badge>
                              ) : offering.isElective ? (
                                <Badge tone="brand">Elective</Badge>
                              ) : course ? (
                                <Badge tone="neutral">{COURSE_KIND_LABEL[course.kind]}</Badge>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                              {course?.code} · {course?.credits} credits · {course?.hoursPerWeek}{' '}
                              hours a week · {course?.ciaMax} internal + {course?.eseMax} external
                              {offering.isElective
                                ? ` · ${offering.enrolledIds.length} opted in`
                                : ''}
                            </span>
                          </span>

                          {manage ? (
                            <span className="flex items-center gap-2">
                              <Select
                                aria-label={`Faculty for ${course?.title}`}
                                value={offering.facultyId}
                                className="h-9 min-w-[13rem] text-[13px]"
                                onChange={(e) => {
                                  assignOffering({
                                    sectionId: section.id,
                                    courseId: offering.courseId,
                                    facultyId: e.target.value,
                                  });
                                  toast.success('Faculty assigned', {
                                    description: 'The timetable has been updated to match.',
                                  });
                                }}
                              >
                                <optgroup
                                  label={
                                    programme.level === 'pg'
                                      ? 'Qualified for postgraduate teaching'
                                      : 'Teaching staff'
                                  }
                                >
                                  {pool.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.name}
                                      {f.designation ? ` · ${DESIGNATION_LABEL[f.designation]}` : ''}
                                    </option>
                                  ))}
                                </optgroup>
                                {mismatched && faculty ? (
                                  <optgroup label="Currently assigned">
                                    <option value={faculty.id}>{faculty.name}</option>
                                  </optgroup>
                                ) : null}
                              </Select>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  removeOffering(section.id, offering.courseId);
                                  toast.success(`${course?.title} withdrawn from ${section.label}`);
                                }}
                              >
                                Remove
                              </Button>
                            </span>
                          ) : (
                            <span className="text-[13px] text-ink-2">{faculty?.name ?? '—'}</span>
                          )}

                          {mismatched ? (
                            <Badge tone="warning" icon={<TriangleAlert className="size-3" />}>
                              Not qualified for a postgraduate paper
                            </Badge>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </>
          ) : (
            <CardBody>
              <EmptyState
                icon={<Layers className="size-6" />}
                title="No cohort selected"
                description="Pick a cohort to see the papers it studies this semester."
              />
            </CardBody>
          )}
        </MotionCard>
      </div>

      {section ? (
        <AddPaperDialog
          open={addPaperOpen}
          onClose={() => setAddPaperOpen(false)}
          section={section}
        />
      ) : null}
      {section && editOpen ? (
        <EditCohortDialog section={section} onClose={() => setEditOpen(false)} />
      ) : null}
      <NewCohortDialog
        open={newSectionOpen}
        onClose={() => setNewSectionOpen(false)}
        onCreated={setSelectedId}
      />
      <NewCourseDialog open={newCourseOpen} onClose={() => setNewCourseOpen(false)} />
    </>
  );
}

/* ── adding a paper to a cohort ──────────────────────────────────────── */

function AddPaperDialog({
  open,
  onClose,
  section,
}: {
  open: boolean;
  onClose: () => void;
  section: Section;
}) {
  const db = useDatabase();
  const already = new Set(offeringsOf(db, section.id).map((o) => o.courseId));
  // Only papers the syllabus prescribes for this programme and semester.
  const available = coursesOfProgramme(db, section.programmeId, section.semester).filter(
    (c) => !already.has(c.id),
  );

  const [courseId, setCourseId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const pool = eligibleFaculty(db, courseId || undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add a paper to ${section.label}`}
      description={`Only papers the syllabus prescribes for semester ${section.semester} are listed.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!courseId || !facultyId}
            onClick={() => {
              assignOffering({ sectionId: section.id, courseId, facultyId });
              toast.success('Paper added', {
                description: `${courseById(db, courseId)?.title} is now part of ${section.label}.`,
              });
              setCourseId('');
              setFacultyId('');
              onClose();
            }}
          >
            Add paper
          </Button>
        </>
      }
    >
      {available.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">
          This cohort already studies every paper the syllabus prescribes for semester{' '}
          {section.semester}.
        </p>
      ) : (
        <div className="space-y-4">
          <Field label="Paper" required htmlFor="ap">
            <Select
              id="ap"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setFacultyId('');
              }}
            >
              <option value="">Choose a paper…</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.code}) · {c.credits} credits
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Faculty"
            required
            htmlFor="af"
            hint={courseId ? `${pool.length} qualified to take this paper` : undefined}
          >
            <Select
              id="af"
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              disabled={!courseId}
            >
              <option value="">Choose a member of staff…</option>
              {pool.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.designation ? ` · ${DESIGNATION_LABEL[f.designation]}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ── editing a cohort ─────────────────────────────────────────────────── */

function EditCohortDialog({ section, onClose }: { section: Section; onClose: () => void }) {
  const db = useDatabase();
  const programme = programmeById(db, section.programmeId);
  const pool = db.users.filter(
    (u) =>
      (u.roles.includes('faculty') || u.roles.includes('tutor')) &&
      u.departmentId === programme?.departmentId,
  );
  const onRoll = studentsInSection(db, section.id).length;

  const [room, setRoom] = useState(section.room);
  const [strength, setStrength] = useState(section.strength);
  const [tutorId, setTutorId] = useState(section.tutorId);
  const [semester, setSemester] = useState(section.semester);

  return (
    <Modal
      open
      onClose={onClose}
      title={section.label}
      description={`${programme?.name} · batch ${section.batch} · ${onRoll} on roll`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={strength < onRoll}
            onClick={() => {
              updateSection({ sectionId: section.id, room, strength, tutorId, semester });
              toast.success(`${section.label} updated`, {
                description:
                  tutorId !== section.tutorId
                    ? `${userById(db, tutorId)?.name} is now the tutor and has been notified.`
                    : undefined,
              });
              onClose();
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tutor" htmlFor="et" hint="The class advisor for this cohort.">
          <Select id="et" value={tutorId} onChange={(e) => setTutorId(e.target.value)}>
            {pool.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.designation ? ` · ${DESIGNATION_LABEL[f.designation]}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Semester"
            htmlFor="es"
            hint="Advancing a cohort changes which papers it studies."
          >
            <Select
              id="es"
              value={String(semester)}
              onChange={(e) => setSemester(Number(e.target.value))}
            >
              {Array.from({ length: programme?.semesters ?? 6 }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Room" htmlFor="er">
            <Input id="er" value={room} onChange={(e) => setRoom(e.target.value)} />
          </Field>
        </div>

        <Field
          label="Sanctioned strength"
          htmlFor="est"
          error={strength < onRoll ? `${onRoll} students are already on roll.` : undefined}
        >
          <Input
            id="est"
            type="number"
            min={1}
            max={120}
            value={strength}
            invalid={strength < onRoll}
            onChange={(e) => setStrength(Number(e.target.value))}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ── opening a cohort ─────────────────────────────────────────────────── */

function NewCohortDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const db = useDatabase();
  const [programmeId, setProgrammeId] = useState(db.programmes[0]?.id ?? '');
  const programme = programmeById(db, programmeId);
  const [batch, setBatch] = useState(new Date().getFullYear());
  const [section, setSection] = useState('A');
  const [semester, setSemester] = useState(1);
  const [tutorId, setTutorId] = useState('');
  const [room, setRoom] = useState('');

  const pool = db.users.filter(
    (u) =>
      (u.roles.includes('faculty') || u.roles.includes('tutor')) &&
      u.departmentId === programme?.departmentId,
  );
  const duplicate = db.sections.some(
    (s) => s.programmeId === programmeId && s.batch === batch && s.section === section,
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open a cohort"
      description="The papers the syllabus prescribes for the semester are set up with it, along with a blank week."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!tutorId || duplicate}
            onClick={() => {
              const id = createSection({
                programmeId,
                batch,
                section: section.toUpperCase(),
                semester,
                tutorId,
                room: room || 'To be allotted',
                strength: programme?.intake ?? 36,
              });
              onCreated(id);
              toast.success('Cohort opened', {
                description: 'Its papers have been created — set a member of staff against each.',
              });
              onClose();
            }}
          >
            Open cohort
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Programme" required htmlFor="np">
          <Select
            id="np"
            value={programmeId}
            onChange={(e) => {
              setProgrammeId(e.target.value);
              setTutorId('');
            }}
          >
            {db.programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {departmentById(db, p.departmentId)?.shortName}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Batch"
            required
            htmlFor="nb"
            error={duplicate ? 'Already exists.' : undefined}
          >
            <Input
              id="nb"
              type="number"
              min={2015}
              max={2100}
              value={batch}
              invalid={duplicate}
              onChange={(e) => setBatch(Number(e.target.value))}
            />
          </Field>
          <Field label="Section" required htmlFor="ns">
            <Input
              id="ns"
              maxLength={1}
              value={section}
              onChange={(e) => setSection(e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Semester" htmlFor="nsem">
            <Select
              id="nsem"
              value={String(semester)}
              onChange={(e) => setSemester(Number(e.target.value))}
            >
              {Array.from({ length: programme?.semesters ?? 6 }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Tutor" required htmlFor="nt" hint="From the programme's own department.">
          <Select id="nt" value={tutorId} onChange={(e) => setTutorId(e.target.value)}>
            <option value="">Choose a tutor…</option>
            {pool.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.designation ? ` · ${DESIGNATION_LABEL[f.designation]}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Room" htmlFor="nr">
          <Input
            id="nr"
            placeholder="CS-301"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ── adding a paper to the syllabus ──────────────────────────────────── */

function NewCourseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDatabase();
  const [programmeId, setProgrammeId] = useState(db.programmes[0]?.id ?? '');
  const programme = programmeById(db, programmeId);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [semester, setSemester] = useState(1);
  const [kind, setKind] = useState<CourseKind>('core');
  const [credits, setCredits] = useState(4);
  const [hoursPerWeek, setHoursPerWeek] = useState(4);

  const practical = kind === 'practical';
  const duplicate = db.courses.some(
    (c) => c.code.toLowerCase() === code.trim().toLowerCase() && code.trim() !== '',
  );
  const valid = title.trim().length > 3 && code.trim().length > 0 && !duplicate;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a paper to the syllabus"
      description="A paper belongs to one programme and one semester — that is what decides who studies it."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              createCourse({
                code: code.trim().toUpperCase(),
                title: title.trim(),
                programmeId,
                semester,
                kind,
                credits,
                hoursPerWeek,
                // A practical is marked 40 internal / 60 external; theory 25 / 75.
                ciaMax: practical ? 40 : 25,
                eseMax: practical ? 60 : 75,
                labKind: practical ? 'computer' : undefined,
              });
              toast.success(`${title.trim()} added`, {
                description: `Offerable to ${programme?.shortName} semester ${semester}.`,
              });
              setCode('');
              setTitle('');
              onClose();
            }}
          >
            Add paper
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <Field label="Title" required htmlFor="ct">
            <Input
              id="ct"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Advanced Database Technology"
            />
          </Field>
          <Field label="Code" required htmlFor="cc" error={duplicate ? 'In use.' : undefined}>
            <Input
              id="cc"
              value={code}
              invalid={duplicate}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="26UCS501"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Programme" required htmlFor="cp">
            <Select id="cp" value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
              {db.programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.shortName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Semester" htmlFor="cs">
            <Select
              id="cs"
              value={String(semester)}
              onChange={(e) => setSemester(Number(e.target.value))}
            >
              {Array.from({ length: programme?.semesters ?? 6 }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Kind" htmlFor="ck">
            <Select id="ck" value={kind} onChange={(e) => setKind(e.target.value as CourseKind)}>
              {(Object.keys(COURSE_KIND_LABEL) as CourseKind[]).map((k) => (
                <option key={k} value={k}>
                  {COURSE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Credits" htmlFor="ccr">
            <Input
              id="ccr"
              type="number"
              min={1}
              max={12}
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
            />
          </Field>
          <Field label="Hours a week" htmlFor="chw">
            <Input
              id="chw"
              type="number"
              min={1}
              max={12}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(Number(e.target.value))}
            />
          </Field>
        </div>

        <p className="rounded-xl bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
          {practical
            ? 'A practical is marked 40 internal and 60 external, and is timetabled into a laboratory.'
            : 'A theory paper is marked 25 internal and 75 external.'}
        </p>
      </div>
    </Modal>
  );
}
