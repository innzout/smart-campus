import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  BookOpen,
  FlaskConical,
  BookPlus,
  Pencil,
  GraduationCap,
  Layers,
  Plus,
  TriangleAlert,
  UserCog,
} from 'lucide-react';
import { useCan } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import {
  classesByStage,
  classSubjectsOf,
  eligibleTeachers,
  hscGroupOf,
  studentsInClass,
  subjectsOfferedTo,
  userById,
} from '@/lib/queries';
import {
  assignClassSubject,
  createClass,
  createSubject,
  removeClassSubject,
  updateClass,
} from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { cn, num } from '@/lib/utils';
import { DESIGNATION_LABEL, STAGE_LABEL } from '@/data/types';
import type { LabKind, SchoolClass, SubjectKind } from '@/data/types';

/**
 * Academic setup — the structure every other module hangs off.
 *
 * The thing a school needs this screen to get right is that the subject set is
 * not uniform: classes 1 to 5 study four subjects, 6 to 8 study six, 9 and 10
 * drop Computer Science, and 11 and 12 study two languages plus whichever four
 * their Higher Secondary group dictates. So subjects are a catalogue scoped by
 * grade, and what a class studies is an explicit assignment with a teacher
 * against it — not something inferred from the grade number.
 */
export default function Academics() {
  const db = useDatabase();
  const can = useCan();
  const manage = can('academic.manage');

  const stages = classesByStage(db);
  const [selectedId, setSelectedId] = useState<string>(
    () => db.classes.find((c) => c.grade === 11)?.id ?? db.classes[0]?.id ?? '',
  );
  const [newClassOpen, setNewClassOpen] = useState(false);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [editClassOpen, setEditClassOpen] = useState(false);
  const [newSubjectOpen, setNewSubjectOpen] = useState(false);

  const cls = db.classes.find((c) => c.id === selectedId);
  const offered = cls ? classSubjectsOf(db, cls.id) : [];
  const group = hscGroupOf(db, cls);

  const unstaffed = db.classSubjects.filter(
    (cs) => !db.users.some((u) => u.id === cs.teacherId),
  ).length;

  return (
    <>
      <PageHeader
        title="Academic setup"
        subtitle={`${db.classes.length} classes across ${stages.length} stages · ${db.subjects.length} subjects in the catalogue`}
        action={
          manage ? (
            <>
              <Button
                variant="secondary"
                icon={<BookPlus className="size-4" />}
                onClick={() => setNewSubjectOpen(true)}
              >
                Add subject to catalogue
              </Button>
              <Button icon={<Plus className="size-4" />} onClick={() => setNewClassOpen(true)}>
                New class
              </Button>
            </>
          ) : null
        }
      />

      <StatGrid>
        <StatTile label="Classes" value={db.classes.length} note="Sections on roll" icon={Layers} />
        <StatTile
          label="Students"
          value={num(db.users.filter((u) => u.roles.includes('student')).length)}
          note="Across all stages"
          icon={GraduationCap}
          delay={0.06}
        />
        <StatTile
          label="Subject offerings"
          value={db.classSubjects.length}
          note="Subject–class–teacher links"
          icon={BookOpen}
          delay={0.12}
        />
        <StatTile
          label="Without a teacher"
          value={unstaffed}
          note={unstaffed ? 'Needs assigning' : 'Every subject is staffed'}
          icon={unstaffed ? TriangleAlert : UserCog}
          tone={unstaffed ? 'critical' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,19rem)_1fr]">
        {/* ── the school's structure, by stage ── */}
        <MotionCard delay={0.1}>
          <CardHeader title="Classes" subtitle="Grouped by stage, as a school thinks of them" />
          <CardBody className="space-y-4 pt-4">
            {stages.map(({ stage, label, classes }) => (
              <div key={stage}>
                <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
                  {label}
                  <span className="ml-1.5 font-normal tracking-normal normal-case opacity-70">
                    {stage === 'primary'
                      ? '· Secondary Grade Teachers'
                      : stage === 'higher-secondary'
                        ? '· P.G. Assistants, by group'
                        : '· B.T. Assistants'}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {classes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                        c.id === selectedId
                          ? 'border-brand-500/50 bg-brand-500/12 text-brand-600 dark:text-brand-300'
                          : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:text-ink',
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardBody>
        </MotionCard>

        {/* ── the selected class's subject set ── */}
        <MotionCard delay={0.16}>
          {cls ? (
            <>
              <CardHeader
                title={`Class ${cls.label}`}
                subtitle={[
                  STAGE_LABEL[cls.stage],
                  cls.room,
                  `${studentsInClass(db, cls.id).length} on roll`,
                  group?.name,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                action={
                  manage ? (
                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Pencil className="size-3.5" />}
                        onClick={() => setEditClassOpen(true)}
                      >
                        Edit class
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Plus className="size-3.5" />}
                        onClick={() => setAddSubjectOpen(true)}
                      >
                        Add subject
                      </Button>
                    </span>
                  ) : null
                }
              />
              <CardBody className="pt-4">
                {group ? (
                  <p className="mb-4 rounded-xl bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
                    <span className="font-semibold text-ink">{group.code} — {group.name}.</span>{' '}
                    {group.description} Tamil and English are compulsory alongside the four group
                    subjects.
                  </p>
                ) : null}

                {offered.length === 0 ? (
                  <EmptyState
                    icon={<BookOpen className="size-6" />}
                    title="No subjects assigned yet"
                    description="Add the subjects this class studies and name the teacher for each."
                  />
                ) : (
                  <ul className="space-y-2">
                    {offered.map((cs) => {
                      const subject = db.subjects.find((s) => s.id === cs.subjectId);
                      const teacher = userById(db, cs.teacherId);
                      const pool = eligibleTeachers(db, cls.grade, cs.subjectId);
                      // A teacher outside the eligible pool is worth flagging:
                      // the wrong cadre in front of a class is an inspection
                      // problem, not a cosmetic one.
                      const mismatched = !!teacher && !pool.some((t) => t.id === teacher.id);

                      return (
                        <li
                          key={cs.id}
                          className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[13.5px] font-semibold text-ink">
                                {subject?.name ?? 'Unknown subject'}
                              </span>
                              {subject?.hasPractical ? (
                                <Badge tone="info" icon={<FlaskConical className="size-3" />}>
                                  Practical
                                </Badge>
                              ) : null}
                              {subject?.kind === 'language' ? (
                                <Badge tone="neutral">Language</Badge>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                              {subject?.nameTa ? `${subject.nameTa} · ` : ''}
                              {subject?.code} · {cs.periodsPerWeek} periods a week ·{' '}
                              {subject?.hasPractical
                                ? `${subject.maxMarks} theory + ${subject.practicalMarks} practical`
                                : `out of ${subject?.maxMarks ?? 100}`}
                            </span>
                          </span>

                          {manage ? (
                            <span className="flex items-center gap-2">
                              <Select
                                aria-label={`Teacher for ${subject?.name}`}
                                value={cs.teacherId}
                                className="h-9 min-w-[13rem] text-[13px]"
                                onChange={(e) => {
                                  assignClassSubject({
                                    classId: cls.id,
                                    subjectId: cs.subjectId,
                                    teacherId: e.target.value,
                                  });
                                  toast.success('Teacher assigned', {
                                    description: 'The timetable has been updated to match.',
                                  });
                                }}
                              >
                                {/* The eligible cadre first, then everyone else
                                    so an exception is possible but deliberate. */}
                                <optgroup label={`Qualified for class ${cls.grade}`}>
                                  {pool.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                      {t.designation ? ` · ${DESIGNATION_LABEL[t.designation]}` : ''}
                                    </option>
                                  ))}
                                </optgroup>
                                {mismatched && teacher ? (
                                  <optgroup label="Currently assigned">
                                    <option value={teacher.id}>{teacher.name}</option>
                                  </optgroup>
                                ) : null}
                              </Select>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  removeClassSubject(cls.id, cs.subjectId);
                                  toast.success(`${subject?.name} withdrawn from ${cls.label}`);
                                }}
                              >
                                Remove
                              </Button>
                            </span>
                          ) : (
                            <span className="text-[13px] text-ink-2">{teacher?.name ?? '—'}</span>
                          )}

                          {mismatched ? (
                            <Badge tone="warning" icon={<TriangleAlert className="size-3" />}>
                              Outside the usual cadre for class {cls.grade}
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
                title="No class selected"
                description="Pick a class to see the subjects it studies."
              />
            </CardBody>
          )}
        </MotionCard>
      </div>

      {cls ? (
        <AddSubjectDialog
          open={addSubjectOpen}
          onClose={() => setAddSubjectOpen(false)}
          cls={cls}
        />
      ) : null}
      <NewClassDialog
        open={newClassOpen}
        onClose={() => setNewClassOpen(false)}
        onCreated={setSelectedId}
      />
      {cls && editClassOpen ? (
        <EditClassDialog cls={cls} onClose={() => setEditClassOpen(false)} />
      ) : null}
      <NewSubjectDialog open={newSubjectOpen} onClose={() => setNewSubjectOpen(false)} />
    </>
  );
}

/* ── editing a class once it exists ──────────────────────────────────── */

/**
 * Rooms get reallocated, a class teacher goes on long leave, and the sanctioned
 * strength changes at admission time. Being able to open a class but never
 * amend it is the kind of gap that turns into a phone call to us.
 */
function EditClassDialog({ cls, onClose }: { cls: SchoolClass; onClose: () => void }) {
  const db = useDatabase();
  const [room, setRoom] = useState(cls.room);
  const [strength, setStrength] = useState(cls.strength);
  const [classTeacherId, setClassTeacherId] = useState(cls.classTeacherId);
  const [hscGroupId, setHscGroupId] = useState(cls.hscGroupId ?? '');

  const pool = eligibleTeachers(db, cls.grade);
  const onRoll = studentsInClass(db, cls.id).length;
  const current = userById(db, cls.classTeacherId);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Class ${cls.label}`}
      description={`${STAGE_LABEL[cls.stage]} · ${onRoll} on roll`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={strength < onRoll}
            onClick={() => {
              updateClass({
                classId: cls.id,
                room: room.trim() || cls.room,
                strength,
                classTeacherId,
                hscGroupId: cls.stage === 'higher-secondary' ? hscGroupId : undefined,
              });
              toast.success(`Class ${cls.label} updated`, {
                description:
                  classTeacherId !== cls.classTeacherId
                    ? `${userById(db, classTeacherId)?.name} is now the class teacher and has been notified.`
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
        <Field label="Class teacher" htmlFor="ect">
          <Select
            id="ect"
            value={classTeacherId}
            onChange={(e) => setClassTeacherId(e.target.value)}
          >
            <optgroup label={`Qualified for class ${cls.grade}`}>
              {pool.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.designation ? ` · ${DESIGNATION_LABEL[t.designation]}` : ''}
                </option>
              ))}
            </optgroup>
            {current && !pool.some((t) => t.id === current.id) ? (
              <optgroup label="Currently assigned">
                <option value={current.id}>{current.name}</option>
              </optgroup>
            ) : null}
          </Select>
        </Field>

        {cls.stage === 'higher-secondary' ? (
          <Field
            label="Higher Secondary group"
            htmlFor="ehg"
            hint="Changing the group does not rewrite the subjects already assigned — withdraw and add those deliberately."
          >
            <Select id="ehg" value={hscGroupId} onChange={(e) => setHscGroupId(e.target.value)}>
              {db.hscGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} — {g.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Room" htmlFor="erm">
            <Input id="erm" value={room} onChange={(e) => setRoom(e.target.value)} />
          </Field>
          <Field
            label="Sanctioned strength"
            htmlFor="est"
            error={strength < onRoll ? `${onRoll} children are already on roll.` : undefined}
          >
            <Input
              id="est"
              type="number"
              min={1}
              max={80}
              value={strength}
              invalid={strength < onRoll}
              onChange={(e) => setStrength(Number(e.target.value))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ── adding a subject the school offers ──────────────────────────────── */

/**
 * The catalogue ships with the Tamil Nadu state board subjects, but a school
 * teaching Hindi, French, Yoga or Moral Science has nowhere to put it otherwise
 * — and telling a correspondent "we will add that for you" is the wrong answer.
 */
function NewSubjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDatabase();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [kind, setKind] = useState<SubjectKind>('core');
  const [fromGrade, setFromGrade] = useState(6);
  const [toGrade, setToGrade] = useState(10);
  const [maxMarks, setMaxMarks] = useState(100);
  const [hasPractical, setHasPractical] = useState(false);
  const [labKind, setLabKind] = useState<LabKind>('computer');
  const [practicalMarks, setPracticalMarks] = useState(30);

  const duplicate = db.subjects.some(
    (sub) => sub.code.toLowerCase() === code.trim().toLowerCase() && code.trim() !== '',
  );
  const valid = name.trim().length > 1 && code.trim().length > 0 && !duplicate && toGrade >= fromGrade;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a subject to the catalogue"
      description="The grades you choose decide which classes may be given this subject."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              createSubject({
                code: code.trim().toUpperCase(),
                name: name.trim(),
                nameTa: nameTa.trim() || undefined,
                kind,
                grades: Array.from({ length: toGrade - fromGrade + 1 }, (_, i) => fromGrade + i),
                maxMarks,
                hasPractical,
                practicalMarks: hasPractical ? practicalMarks : 0,
                labKind: hasPractical ? labKind : undefined,
              });
              toast.success(`${name.trim()} added to the catalogue`, {
                description: `Now offerable to classes ${fromGrade} to ${toGrade}.`,
              });
              setCode('');
              setName('');
              setNameTa('');
              onClose();
            }}
          >
            Add subject
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Field label="Subject name" required htmlFor="nsn">
            <Input
              id="nsn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hindi"
            />
          </Field>
          <Field
            label="Code"
            required
            htmlFor="nsc"
            error={duplicate ? 'Already in use.' : undefined}
          >
            <Input
              id="nsc"
              value={code}
              invalid={duplicate}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="HIN"
            />
          </Field>
        </div>

        <Field label="Name in Tamil" htmlFor="nst" hint="Shown to parents alongside the English name.">
          <Input id="nst" value={nameTa} onChange={(e) => setNameTa(e.target.value)} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kind" htmlFor="nsk">
            <Select id="nsk" value={kind} onChange={(e) => setKind(e.target.value as SubjectKind)}>
              <option value="language">Language</option>
              <option value="core">Core</option>
              <option value="elective">Elective</option>
              <option value="co-curricular">Co-curricular</option>
            </Select>
          </Field>
          <Field label="Marks (theory)" htmlFor="nsm">
            <Input
              id="nsm"
              type="number"
              min={10}
              max={200}
              step={5}
              value={maxMarks}
              onChange={(e) => setMaxMarks(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Offered from class" htmlFor="nsf">
            <Select
              id="nsf"
              value={String(fromGrade)}
              onChange={(e) => setFromGrade(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Class {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="up to class"
            htmlFor="nstg"
            error={toGrade < fromGrade ? 'Must not be below the lower class.' : undefined}
          >
            <Select
              id="nstg"
              value={String(toGrade)}
              onChange={(e) => setToGrade(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Class {g}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Checkbox
          label="This subject has a practical component"
          checked={hasPractical}
          onChange={(e) => setHasPractical(e.target.checked)}
        />

        {hasPractical ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Practical runs in" htmlFor="nsl">
              <Select
                id="nsl"
                value={labKind}
                onChange={(e) => setLabKind(e.target.value as LabKind)}
              >
                {db.labs.map((l) => (
                  <option key={l.id} value={l.kind}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Practical marks" htmlFor="nsp">
              <Input
                id="nsp"
                type="number"
                min={5}
                max={100}
                step={5}
                value={practicalMarks}
                onChange={(e) => setPracticalMarks(Number(e.target.value))}
              />
            </Field>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/* ── adding a subject to a class ──────────────────────────────────────── */

function AddSubjectDialog({
  open,
  onClose,
  cls,
}: {
  open: boolean;
  onClose: () => void;
  cls: SchoolClass;
}) {
  const db = useDatabase();
  const already = new Set(classSubjectsOf(db, cls.id).map((cs) => cs.subjectId));
  // Only subjects the catalogue offers to this grade, minus what it already has.
  const available = subjectsOfferedTo(db, cls.grade).filter((s) => !already.has(s.id));

  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [periods, setPeriods] = useState(5);

  const pool = useMemo(
    () => eligibleTeachers(db, cls.grade, subjectId || undefined),
    [db, cls.grade, subjectId],
  );

  const submit = () => {
    if (!subjectId || !teacherId) return;
    assignClassSubject({ classId: cls.id, subjectId, teacherId, periodsPerWeek: periods });
    toast.success('Subject added', {
      description: `${db.subjects.find((s) => s.id === subjectId)?.name} is now part of ${cls.label}.`,
    });
    setSubjectId('');
    setTeacherId('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add a subject to ${cls.label}`}
      description={`Only subjects the school offers to class ${cls.grade} are listed.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!subjectId || !teacherId}>
            Add subject
          </Button>
        </>
      }
    >
      {available.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">
          This class already studies every subject the catalogue offers to class {cls.grade}.
        </p>
      ) : (
        <div className="space-y-4">
          <Field label="Subject" required htmlFor="subject">
            <Select
              id="subject"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTeacherId('');
              }}
            >
              <option value="">Choose a subject…</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}){s.hasPractical ? ' · with practical' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Teacher"
            required
            htmlFor="teacher"
            hint={
              subjectId
                ? `${pool.length} member${pool.length === 1 ? '' : 's'} of staff qualified for class ${cls.grade}`
                : undefined
            }
          >
            <Select
              id="teacher"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              disabled={!subjectId}
            >
              <option value="">Choose a teacher…</option>
              {pool.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.designation ? ` · ${DESIGNATION_LABEL[t.designation]}` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Periods a week" htmlFor="periods">
            <Input
              id="periods"
              type="number"
              min={1}
              max={10}
              value={periods}
              onChange={(e) => setPeriods(Number(e.target.value))}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ── opening a new class ──────────────────────────────────────────────── */

function NewClassDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const db = useDatabase();
  const [grade, setGrade] = useState(11);
  const [section, setSection] = useState('C');
  const [room, setRoom] = useState('');
  const [hscGroupId, setHscGroupId] = useState(db.hscGroups[0]?.id ?? '');
  const [classTeacherId, setClassTeacherId] = useState('');
  const [strength, setStrength] = useState(30);

  const pool = eligibleTeachers(db, grade);
  const needsGroup = grade >= 11;
  const duplicate = db.classes.some((c) => c.grade === grade && c.section === section);

  const submit = () => {
    if (!classTeacherId || duplicate) return;
    const id = createClass({
      grade,
      section: section.toUpperCase(),
      classTeacherId,
      room: room || 'To be allotted',
      hscGroupId: needsGroup ? hscGroupId : undefined,
      strength,
    });
    onCreated(id);
    toast.success(`Class ${grade}-${section.toUpperCase()} opened`, {
      description: needsGroup
        ? 'The group’s subjects have been assigned — set a teacher against each.'
        : 'Add the subjects this class will study.',
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open a new class"
      description="A Higher Secondary class is defined by its subject group, so its subjects are set up with it."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!classTeacherId || duplicate}>
            Open class
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Class" required htmlFor="grade">
            <Select
              id="grade"
              value={String(grade)}
              onChange={(e) => {
                setGrade(Number(e.target.value));
                setClassTeacherId('');
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Class {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Section"
            required
            htmlFor="section"
            error={duplicate ? `Class ${grade}-${section.toUpperCase()} already exists.` : undefined}
          >
            <Input
              id="section"
              maxLength={1}
              value={section}
              invalid={duplicate}
              onChange={(e) => setSection(e.target.value.toUpperCase())}
            />
          </Field>
        </div>

        {needsGroup ? (
          <Field
            label="Higher Secondary group"
            required
            htmlFor="group"
            hint="Decides the four subjects taken alongside Tamil and English."
          >
            <Select id="group" value={hscGroupId} onChange={(e) => setHscGroupId(e.target.value)}>
              {db.hscGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} — {g.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field
          label="Class teacher"
          required
          htmlFor="ct"
          hint={
            grade <= 5
              ? 'Secondary Grade Teachers handle classes 1 to 5.'
              : grade <= 10
                ? 'B.T. Assistants handle classes 6 to 10.'
                : 'P.G. Assistants handle classes 11 and 12.'
          }
        >
          <Select id="ct" value={classTeacherId} onChange={(e) => setClassTeacherId(e.target.value)}>
            <option value="">Choose a class teacher…</option>
            {pool.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.designation ? ` · ${DESIGNATION_LABEL[t.designation]}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Room" htmlFor="room">
            <Input
              id="room"
              placeholder="Room 45"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </Field>
          <Field label="Sanctioned strength" htmlFor="strength">
            <Input
              id="strength"
              type="number"
              min={1}
              max={60}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
