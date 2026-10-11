/**
 * Sanity checks over the generated JSON.
 *
 * These exist because the failures that matter in a demo are not type errors —
 * they are a screen that renders correctly and says nothing, or says something
 * false. A bus allotted beyond its seats, a class with no subjects, a cover
 * teacher who is already teaching that period: all compile, all look fine, all
 * wrong in front of a school. Runs as part of `npm run seed`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const db = {};
for (const f of readdirSync(DATA)) {
  if (f.endsWith('.json')) db[f.replace('.json', '')] = JSON.parse(readFileSync(join(DATA, f), 'utf8'));
}

let bad = 0;
const ok = (label, pass, detail = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!pass) bad++;
};

const sub = (id) => db.subjects.find((s) => s.id === id);
const user = (id) => db.users.find((u) => u.id === id);

/* every class studies something */
const empty = db.classes.filter((c) => !db.classSubjects.some((cs) => cs.classId === c.id));
ok('every class has a subject set', empty.length === 0, empty.map((c) => c.label).join(', '));

/* subject sets differ by stage, which is the whole point */
const counts = {};
for (const c of db.classes) {
  counts[c.label] = db.classSubjects.filter((cs) => cs.classId === c.id).length;
}
ok(
  'subject count varies by stage',
  counts['1-A'] !== counts['8-A'] || counts['8-A'] !== counts['11-A'],
  `1-A:${counts['1-A']} 8-A:${counts['8-A']} 11-A:${counts['11-A']} 11-B:${counts['11-B']}`,
);

/* HSc classes carry a group, lower classes do not */
const hsc = db.classes.filter((c) => c.grade >= 11);
ok('classes 11 and 12 all carry a group', hsc.every((c) => c.hscGroupId), `${hsc.length} classes`);
ok(
  'no class below 11 carries a group',
  db.classes.filter((c) => c.grade < 11).every((c) => !c.hscGroupId),
);

/* group subjects actually resolve */
const badGroup = db.hscGroups.flatMap((g) => g.subjectIds.filter((id) => !sub(id)));
ok('every group subject resolves', badGroup.length === 0, badGroup.join(', '));

/* every subject offering has a real teacher */
const noTeacher = db.classSubjects.filter((cs) => !user(cs.teacherId));
ok('every subject offering has a teacher', noTeacher.length === 0, `${noTeacher.length} unstaffed`);

/* teaching cadre matches the grade it is assigned to */
const GRADES = {
  sgt: [1, 2, 3, 4, 5],
  'bt-assistant': [6, 7, 8, 9, 10],
  'pg-assistant': [11, 12],
};
const mismatch = db.classSubjects.filter((cs) => {
  const cls = db.classes.find((c) => c.id === cs.classId);
  const t = user(cs.teacherId);
  const allowed = t?.designation ? GRADES[t.designation] : undefined;
  return allowed && !allowed.includes(cls.grade);
});
ok('teacher cadre matches the class grade', mismatch.length === 0, `${mismatch.length} mismatches`);

/* roles: nobody has an empty role list; multi-role exists */
ok('every user holds at least one role', db.users.every((u) => u.roles?.length > 0));
const multi = db.users.filter((u) => u.roles.length > 1);
ok('some staff hold several roles', multi.length > 0, `${multi.length} people`);

/* labs and batches */
ok('labs exist with an in-charge and assistant', db.labs.every((l) => user(l.inChargeId) && user(l.assistantId)));
const batchProblems = db.classes
  .map((c) => {
    const practicals = db.classSubjects
      .filter((cs) => cs.classId === c.id)
      .map((cs) => sub(cs.subjectId))
      .filter((s) => s?.hasPractical);
    if (!practicals.length) return null;
    const batches = db.labBatches.filter((b) => b.classId === c.id);
    const roll = db.users.filter((u) => u.classId === c.id && u.roles.includes('student'));
    const tightest = Math.min(
      ...practicals.map((s) => db.labs.find((l) => l.kind === s.labKind)?.capacity ?? 30),
    );
    const need = Math.ceil(roll.length / tightest);
    const sized = batches.every((b) => b.studentIds.length <= tightest);
    const covers = batches.reduce((t, b) => t + b.studentIds.length, 0) === roll.length;
    return batches.length === need && sized && covers ? null : `${c.label}`;
  })
  .filter(Boolean);
ok('batches fit the lab and cover the roll', batchProblems.length === 0, batchProblems.join(', '));

/* substitutions were generated for today */
ok('substitutions exist', db.substitutions.length > 0, `${db.substitutions.length} arranged`);
const selfCover = db.substitutions.filter((s) => s.coverTeacherId === s.absentTeacherId);
ok('nobody covers for themselves', selfCover.length === 0);
/* a cover teacher must not already be teaching that period */
const clash = db.substitutions.filter((s) => {
  const slot = db.timetable.find((t) => t.id === s.slotId);
  return db.timetable.some(
    (t) => t.day === slot.day && t.period === slot.period && t.teacherId === s.coverTeacherId,
  );
});
ok('cover teachers are genuinely free', clash.length === 0, `${clash.length} clashes`);

/* recruitment: pending files, and incomplete ones */
const pending = db.applications.filter((a) => a.status === 'submitted' || a.status === 'under-review');
ok('applications await a decision', pending.length > 0, `${pending.length} pending`);
// Mirrors missingDocuments() in queries.ts: the file must be complete before
// the Principal can approve it, so a pending file with gaps is the normal case.
const TEACHING = ['sgt', 'bt-assistant', 'pg-assistant'];
const missingFor = (a) => {
  const req = ['degree', 'aadhaar', 'pan', 'bank'];
  if (TEACHING.includes(a.designation)) req.push('bed');
  if (a.tetCleared) req.push('tet');
  if (a.experienceYears > 0) req.push('experience');
  const held = new Set(a.documents.map((d) => d.kind));
  return req.filter((k) => !held.has(k));
};
ok(
  'pending files have documents outstanding',
  pending.every((a) => missingFor(a).length > 0),
  'so Approve stays disabled until the file is complete',
);
ok('decided files are complete', db.applications.filter((a) => a.status === 'approved').every((a) => missingFor(a).length === 0));

/* payroll */
ok('payslips exist for several months', new Set(db.payslips.map((p) => p.month)).size >= 3);
const badNet = db.payslips.filter((p) => p.net !== p.gross - p.deductions);
ok('payslip net equals gross minus deductions', badNet.length === 0, `${badNet.length} wrong`);
ok('the correspondent draws no salary', !db.salaries.some((s) => s.staffId === 'usr-admin'));

/* transport: compliance has something to show, and a queue exists */
const today = new Date().toISOString().slice(0, 10);
ok('a vehicle paper has lapsed', db.vehicles.some((v) => v.fcExpiry < today), 'so the board is not empty');
ok('transport requests are pending', db.studentTransport.some((t) => t.status === 'requested'));
ok('routes map to real vehicles', db.routes.every((r) => db.vehicles.some((v) => v.id === r.vehicleId)));
/* no route oversubscribed beyond its bus */
const over = db.routes.filter((r) => {
  const v = db.vehicles.find((x) => x.id === r.vehicleId);
  const taken = db.studentTransport.filter((t) => t.routeId === r.id && t.status === 'allotted').length;
  return taken > v.capacity;
});
ok('no route is allotted beyond bus capacity', over.length === 0, over.map((r) => r.name).join(', '));

/* branches */
ok('more than one branch exists', db.schools.length > 1);
ok('exactly one main campus', db.schools.filter((s) => s.isMain).length === 1);

/* demo logins still resolve */
for (const email of ['admin@school.edu', 'principal@school.edu', 'teacher@school.edu', 'parent@school.edu', 'student@school.edu', 'accounts@school.edu', 'library@school.edu', 'transport@school.edu', 'hm@school.edu', 'vp@school.edu']) {
  const u = db.users.find((x) => x.email === email);
  ok(`login ${email}`, !!u, u ? u.roles.join(' + ') : 'MISSING');
}

/* the demo child is intact */
const child = db.users.find((u) => u.email === 'student@school.edu');
ok('demo child is in 8-A with a bus seat', child?.classId === 'cls-8A' && db.studentTransport.some((t) => t.studentId === child.id && t.status === 'allotted'), child?.admissionNo);

/* marks respect each subject's own maximum */
const badMarks = db.marks.filter((m) => m.marks > m.maxMarks || m.maxMarks !== (sub(m.subjectId)?.maxMarks ?? 100));
ok('marks sit within the subject maximum', badMarks.length === 0, `${badMarks.length} wrong`);
const practicals = db.marks.filter((m) => m.practicalMarks != null);
ok('practical subjects carry practical marks', practicals.length > 0, `${practicals.length} rows`);

/* no attendance on a Sunday */
const sundays = db.attendance.filter((a) => new Date(a.date).getDay() === 0);
ok('no attendance recorded on a Sunday', sundays.length === 0, `${sundays.length} rows`);

/* ── timetable soundness ─────────────────────────────────────────────── */

/**
 * The generator used to build each class's week on its own, which put the same
 * P.E. teacher in three classes at once — 234 double-bookings that nothing
 * surfaced until the period scheduler started checking. These guard that.
 */
const seenAt = new Map();
const teacherClashes = [];
const labClashes = [];
for (const slot of db.timetable) {
  if (slot.kind === 'break' || slot.kind === 'lunch') continue;
  if (slot.teacherId) {
    const k = 't' + slot.day + '-' + slot.period + '-' + slot.teacherId;
    if (seenAt.has(k)) teacherClashes.push(k);
    else seenAt.set(k, slot.id);
  }
  if (slot.labId) {
    const k = 'l' + slot.day + '-' + slot.period + '-' + slot.labId;
    if (seenAt.has(k)) labClashes.push(k);
    else seenAt.set(k, slot.id);
  }
}
ok('no teacher is booked into two classes at once', teacherClashes.length === 0, teacherClashes.length + ' clashes');
ok('no laboratory is booked twice at once', labClashes.length === 0, labClashes.length + ' clashes');

const lessons = db.timetable.filter((s) => s.kind !== 'break' && s.kind !== 'lunch');
const freePeriods = lessons.filter((s) => !s.subjectId).length;
ok(
  'the week is mostly filled',
  freePeriods / lessons.length < 0.15,
  freePeriods + ' free of ' + lessons.length,
);

// A practical must sit in a lab and name a batch, or the lab page cannot show it.
const brokenPracticals = db.timetable.filter((s) => s.kind === 'lab' && (!s.labId || !s.batchId));
ok('every practical names a lab and a batch', brokenPracticals.length === 0, brokenPracticals.length + ' incomplete');

// A slot's teacher should be the one assigned that subject to that class.
const wrongTeacher = db.timetable.filter((s) => {
  if (!s.subjectId || !s.teacherId) return false;
  const offering = db.classSubjects.find((cs) => cs.classId === s.classId && cs.subjectId === s.subjectId);
  return offering && offering.teacherId !== s.teacherId;
});
ok('timetable teachers match the subject assignment', wrongTeacher.length === 0, wrongTeacher.length + ' mismatched');

// Every class needs a week laid out, or its period editor has no rows to fill
// and the day view reads "nothing scheduled" forever.
const weekless = db.classes.filter((c) => !db.timetable.some((s) => s.classId === c.id));
ok('every class has a week laid out', weekless.length === 0, weekless.map((c) => c.label).join(', '));

const shortWeek = db.classes.filter((c) => {
  const lessons = db.timetable.filter(
    (s) => s.classId === c.id && s.kind !== 'break' && s.kind !== 'lunch',
  ).length;
  return lessons < 20;
});
ok('no class has a stunted week', shortWeek.length === 0, shortWeek.map((c) => c.label).join(', '));

/* ── branch integrity ─────────────────────────────────────────────────── */

/**
 * The branch switcher is only honest if the branches do not bleed into each
 * other. A class teacher drawn from the other school, or a child in a class the
 * branch does not run, would make every figure on screen quietly wrong.
 */
const schoolIds = new Set(db.schools.map((s) => s.id));
const withSchool = ['classes', 'users', 'applications', 'labs', 'circulars', 'events', 'vehicles', 'routes', 'books', 'places'];
for (const name of withSchool) {
  const orphans = db[name].filter((r) => !schoolIds.has(r.schoolId));
  ok(`every ${name} row belongs to a real school`, orphans.length === 0, `${orphans.length} orphaned`);
}

const classOf = new Map(db.classes.map((c) => [c.id, c]));
const crossClass = db.users.filter(
  (u) => u.classId && classOf.get(u.classId)?.schoolId !== u.schoolId,
);
ok('no pupil sits in another branch\'s class', crossClass.length === 0, `${crossClass.length} found`);

const userOf = new Map(db.users.map((u) => [u.id, u]));
const crossTeacher = db.classes.filter(
  (c) => userOf.get(c.classTeacherId)?.schoolId !== c.schoolId,
);
ok('no class teacher comes from another branch', crossTeacher.length === 0, `${crossTeacher.length} found`);

const crossSubject = db.classSubjects.filter((cs) => {
  const cls = classOf.get(cs.classId);
  return cls && userOf.get(cs.teacherId)?.schoolId !== cls.schoolId;
});
ok('no subject is taught across branches', crossSubject.length === 0, `${crossSubject.length} found`);

const crossGuardian = db.users.filter((u) =>
  (u.guardianIds ?? []).some((g) => userOf.get(g)?.schoolId !== u.schoolId),
);
ok('guardians sit in the same branch as their child', crossGuardian.length === 0);

const crossTransport = db.studentTransport.filter((t) => {
  const route = db.routes.find((r) => r.id === t.routeId);
  return route && userOf.get(t.studentId)?.schoolId !== route.schoolId;
});
ok('no child rides another branch\'s bus', crossTransport.length === 0, `${crossTransport.length} found`);

const crossLoan = db.loans.filter((l) => {
  const book = db.books.find((b) => b.id === l.bookId);
  return book && userOf.get(l.studentId)?.schoolId !== book.schoolId;
});
ok('no child borrows from another branch\'s library', crossLoan.length === 0);

/* each branch stands up on its own */
for (const school of db.schools) {
  const pupils = db.users.filter((u) => u.schoolId === school.id && u.roles.includes('student'));
  const staff = db.users.filter((u) => u.schoolId === school.id && u.employeeId);
  const cls = db.classes.filter((c) => c.schoolId === school.id);
  ok(
    `branch "${school.shortName}" has pupils, staff and classes`,
    pupils.length > 0 && staff.length > 0 && cls.length > 0,
    `${cls.length} classes · ${pupils.length} pupils · ${staff.length} staff`,
  );
  // Every branch needs someone who can actually sign in and run it.
  const head = db.users.filter(
    (u) => u.schoolId === school.id && (u.roles.includes('correspondent') || u.roles.includes('principal')),
  );
  ok(`branch "${school.shortName}" has an administrator`, head.length > 0, head.map((h) => h.email).join(', '));
}

/* the two branches genuinely differ, or the switcher demonstrates nothing */
const gradesOf = (id) => [...new Set(db.classes.filter((c) => c.schoolId === id).map((c) => c.grade))].sort((a, b) => a - b);
const main = db.schools.find((s) => s.isMain);
const other = db.schools.find((s) => !s.isMain && db.classes.some((c) => c.schoolId === s.id));
ok(
  'the branches teach different grades',
  !!other && gradesOf(main.id).join() !== gradesOf(other.id).join(),
  other ? `${main.shortName}: ${gradesOf(main.id).join(',')} | ${other.shortName}: ${gradesOf(other.id).join(',')}` : 'only one populated branch',
);

/* ── recruitment documents ───────────────────────────────────────────── */

const RETIRED = ['photo', 'police'];
const stale = db.applications.flatMap((a) => a.documents.filter((d) => RETIRED.includes(d.kind)));
ok('no retired document kinds remain', stale.length === 0, stale.map((d) => d.kind).join(', '));

console.log(`\n${bad === 0 ? 'All checks passed.' : bad + ' CHECK(S) FAILED.'}`);
process.exit(bad === 0 ? 0 : 1);
