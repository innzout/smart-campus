/**
 * Sanity checks over the generated JSON.
 *
 * These exist because the failures that matter in a demo are not type errors —
 * they are a screen that renders correctly and says nothing, or says something
 * false. A student holding an offer they could never have been eligible for, a
 * cohort with no papers, a lecturer in two rooms at once: all compile, all look
 * fine, all wrong in front of a Principal. Runs as part of `npm run seed`.
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

const user = (id) => db.users.find((u) => u.id === id);
const course = (id) => db.courses.find((c) => c.id === id);
const section = (id) => db.sections.find((s) => s.id === id);
const offering = (id) => db.offerings.find((o) => o.id === id);
const programme = (id) => db.programmes.find((p) => p.id === id);

/* ── structure ────────────────────────────────────────────────────────── */

ok('every department has a head', db.departments.every((d) => user(d.hodId)));
ok(
  'every programme belongs to a real department',
  db.programmes.every((p) => db.departments.some((d) => d.id === p.departmentId)),
);
ok(
  'every cohort has a tutor from its own department',
  db.sections.every((s) => {
    const tutor = user(s.tutorId);
    return tutor && tutor.departmentId === programme(s.programmeId)?.departmentId;
  }),
);

const emptyCohorts = db.sections.filter((s) => !db.offerings.some((o) => o.sectionId === s.id));
ok('every cohort studies something', emptyCohorts.length === 0, emptyCohorts.map((s) => s.label).join(', '));

/* A cohort's papers must be the ones its syllabus prescribes for its semester. */
const wrongSemester = db.offerings.filter((o) => {
  const sec = section(o.sectionId);
  const crs = course(o.courseId);
  return !sec || !crs || crs.programmeId !== sec.programmeId || crs.semester !== sec.semester;
});
ok('papers match the cohort’s programme and semester', wrongSemester.length === 0, `${wrongSemester.length} mismatched`);

/* Postgraduate teaching needs a doctorate or NET — a university condition. */
const underqualified = db.offerings.filter((o) => {
  const sec = section(o.sectionId);
  if (programme(sec?.programmeId)?.level !== 'pg') return false;
  const f = user(o.facultyId);
  return f && !f.netCleared && !(f.qualification ?? '').includes('Ph.D.');
});
ok('postgraduate papers are taught by qualified staff', underqualified.length === 0, `${underqualified.length} not qualified`);

ok('every paper has a member of staff', db.offerings.every((o) => user(o.facultyId)));
ok('every user holds at least one role', db.users.every((u) => u.roles?.length > 0));
ok(
  'some staff hold several roles',
  db.users.filter((u) => u.roles.length > 1).length > 0,
  `${db.users.filter((u) => u.roles.length > 1).length} people`,
);

/* ── enrolment and electives ─────────────────────────────────────────── */

const coreGaps = db.offerings.filter((o) => {
  if (o.isElective) return false;
  const roll = db.users.filter((u) => u.sectionId === o.sectionId && u.roles.includes('student'));
  return o.enrolledIds.length !== roll.length;
});
ok('a core paper enrols the whole cohort', coreGaps.length === 0, `${coreGaps.length} incomplete`);

const electiveSections = [...new Set(db.offerings.filter((o) => o.isElective).map((o) => o.sectionId))];
const electiveProblems = electiveSections.filter((sid) => {
  const roll = db.users.filter((u) => u.sectionId === sid && u.roles.includes('student'));
  const chosen = db.offerings
    .filter((o) => o.sectionId === sid && o.isElective)
    .flatMap((o) => o.enrolledIds);
  // Each student takes exactly one of the electives offered.
  return new Set(chosen).size !== roll.length || chosen.length !== roll.length;
});
ok('each student takes exactly one elective', electiveProblems.length === 0, `${electiveProblems.length} cohorts wrong`);

/* ── timetable ────────────────────────────────────────────────────────── */

const seen = new Set();
let facultyClashes = 0;
let labClashes = 0;
for (const slot of db.timetable) {
  if (slot.kind === 'break' || slot.kind === 'lunch') continue;
  if (slot.facultyId) {
    const k = `f${slot.day}-${slot.hour}-${slot.facultyId}`;
    if (seen.has(k)) facultyClashes++;
    else seen.add(k);
  }
  if (slot.labId) {
    const k = `l${slot.day}-${slot.hour}-${slot.labId}`;
    if (seen.has(k)) labClashes++;
    else seen.add(k);
  }
}
ok('no lecturer is booked into two cohorts at once', facultyClashes === 0, `${facultyClashes} clashes`);
ok('no laboratory is booked twice at once', labClashes === 0, `${labClashes} clashes`);

const taught = db.timetable.filter((s) => s.kind !== 'break' && s.kind !== 'lunch');
const free = taught.filter((s) => !s.offeringId && s.kind === 'hour').length;
ok('the week is filled with teaching, library or mentoring', free === 0, `${free} empty hours`);

/* Each paper should get roughly the hours its syllabus allots it. */
const hourGaps = [];
for (const o of db.offerings) {
  const want = course(o.courseId)?.hoursPerWeek ?? 0;
  const got = db.timetable.filter((s) => s.offeringId === o.id).length;
  if (got > want) hourGaps.push(`${course(o.courseId)?.title} ${got}/${want}`);
}
ok('no paper is given more hours than its syllabus allots', hourGaps.length === 0, hourGaps.slice(0, 3).join('; '));

const weekless = db.sections.filter((s) => !db.timetable.some((t) => t.sectionId === s.id));
ok('every cohort has a week laid out', weekless.length === 0, weekless.map((s) => s.label).join(', '));

/* ── attendance ───────────────────────────────────────────────────────── */

ok('attendance is recorded against real papers', db.attendance.every((a) => offering(a.offeringId)));

const strays = db.attendance.filter((a) => !offering(a.offeringId)?.enrolledIds.includes(a.studentId));
ok('nobody is marked for a paper they do not sit', strays.length === 0, `${strays.length} stray rows`);

const sundays = db.attendance.filter((a) => new Date(a.date).getDay() === 0);
ok('no attendance recorded on a Sunday', sundays.length === 0, `${sundays.length} rows`);

/* The per-paper percentage is the figure the whole college turns on. */
const held = new Map();
for (const a of db.attendance) {
  const k = `${a.studentId}|${a.offeringId}`;
  const agg = held.get(k) ?? { h: 0, p: 0 };
  agg.h += 1;
  if (a.status !== 'absent') agg.p += 1;
  held.set(k, agg);
}
const percentages = [...held.values()].map((v) => Math.round((v.p / v.h) * 100));
const short = percentages.filter((p) => p < 75).length;
ok(
  'some students are genuinely short of attendance',
  short > 0,
  `${short} of ${percentages.length} paper enrolments below 75%`,
);
ok(
  'most students are not short',
  short / percentages.length < 0.35,
  `${Math.round((short / percentages.length) * 100)}% short`,
);

/* Condonation only exists in the band where it is actually possible. */
const badCondonation = db.condonations.filter((c) => c.percent >= 75 || c.percent < 65);
ok('condonation only where it is permitted', badCondonation.length === 0, `${badCondonation.length} outside the 65–75 band`);

/* ── results, CGPA and arrears ───────────────────────────────────────── */

const cgpaOf = (sid) => {
  const mine = db.results.filter((r) => r.studentId === sid && r.status === 'pass');
  const credits = mine.reduce((t, r) => t + r.credits, 0);
  return credits ? mine.reduce((t, r) => t + r.gradePoint * r.credits, 0) / credits : 0;
};
const arrearsOf = (sid) => db.results.filter((r) => r.studentId === sid && r.status === 'arrear').length;

const gradeWrong = db.results.filter((r) => (r.total >= 40) !== (r.status === 'pass'));
ok('a pass is exactly 40 and above', gradeWrong.length === 0, `${gradeWrong.length} wrong`);

const pointsWrong = db.results.filter((r) => (r.gradePoint === 0) !== (r.grade === 'RA'));
ok('only a reappear scores zero grade points', pointsWrong.length === 0);

const marksWrong = db.results.filter((r) => r.cia + (r.ese ?? 0) !== r.total);
ok('internal plus external equals the total', marksWrong.length === 0, `${marksWrong.length} wrong`);

const finals = db.users.filter((u) => {
  const sec = section(u.sectionId);
  const prog = programme(u.programmeId);
  return u.roles.includes('student') && sec && prog && sec.semester >= prog.semesters - 1;
});
const withArrears = finals.filter((s) => arrearsOf(s.id) > 0).length;
ok('some final years carry arrears and most do not', withArrears > 0 && withArrears < finals.length * 0.5, `${withArrears} of ${finals.length}`);

const cgpas = db.users.filter((u) => u.roles.includes('student')).map((s) => cgpaOf(s.id)).filter(Boolean);
ok('CGPA spans a believable range', Math.min(...cgpas) < 6 && Math.max(...cgpas) > 8, `${Math.min(...cgpas).toFixed(2)} to ${Math.max(...cgpas).toFixed(2)}`);

/* ── placements ───────────────────────────────────────────────────────── */

const ineligible = db.driveApplications.filter((a) => {
  const drive = db.drives.find((d) => d.id === a.driveId);
  if (!drive) return true;
  return cgpaOf(a.studentId) < drive.minCgpa || arrearsOf(a.studentId) > drive.maxArrears;
});
ok('no application breaches the recruiter’s own bar', ineligible.length === 0, `${ineligible.length} would not have qualified`);

const offers = db.driveApplications.filter((a) => a.stage === 'selected');
ok('some students hold offers', offers.length > 0, `${offers.length} offers`);
ok(
  'every drive is open to a real programme',
  db.drives.every((d) => d.programmeIds.every((p) => programme(p))),
);

/* ── hostel, transport, library ──────────────────────────────────────── */

const occupancy = new Map();
for (const a of db.hostelAllotments.filter((a) => a.status === 'allotted')) {
  occupancy.set(a.roomId, (occupancy.get(a.roomId) ?? 0) + 1);
}
const overfull = db.hostelRooms.filter((r) => (occupancy.get(r.id) ?? 0) > r.capacity);
ok('no hostel room is over capacity', overfull.length === 0, `${overfull.length} overfull`);

const both = db.hostelAllotments
  .filter((a) => a.status === 'allotted')
  .filter((a) => db.studentTransport.some((t) => t.studentId === a.studentId && t.status === 'allotted'));
ok('a resident does not also take the bus', both.length === 0, `${both.length} do both`);

const over = db.routes.filter((r) => {
  const v = db.vehicles.find((x) => x.id === r.vehicleId);
  const taken = db.studentTransport.filter((t) => t.routeId === r.id && t.status === 'allotted').length;
  return v && taken > v.capacity;
});
ok('no route is allotted beyond its bus', over.length === 0, over.map((r) => r.name).join(', '));

const today = new Date().toISOString().slice(0, 10);
ok('a vehicle paper has lapsed', db.vehicles.some((v) => v.fcExpiry < today), 'so the compliance board is not empty');

const wrongLibrary = db.loans.filter((l) => {
  const book = db.books.find((b) => b.id === l.bookId);
  return book && !book.forProgrammes.includes(user(l.studentId)?.programmeId);
});
ok('students borrow only titles meant for their programme', wrongLibrary.length === 0, `${wrongLibrary.length} wrong`);

/* ── recruitment ──────────────────────────────────────────────────────── */

const REQUIRED = ['degree', 'pg', 'aadhaar', 'pan', 'bank'];
const missingFor = (a) => {
  const req = [...REQUIRED];
  if (a.phd) req.push('phd');
  if (a.netCleared) req.push('net');
  if (a.experienceYears > 0) req.push('experience');
  if (a.publications > 0) req.push('publications');
  const have = new Set(a.documents.map((d) => d.kind));
  return req.filter((k) => !have.has(k));
};
const pending = db.applications.filter((a) => a.status === 'submitted' || a.status === 'under-review');
ok('applications await a decision', pending.length > 0, `${pending.length} pending`);
ok(
  'pending files have documents outstanding',
  pending.every((a) => missingFor(a).length > 0),
  'so Approve stays disabled until the file is complete',
);

/* ── sign-ins and the demo student ───────────────────────────────────── */

for (const email of [
  'admin@college.edu',
  'principal@college.edu',
  'coe@college.edu',
  'faculty@college.edu',
  'placement@college.edu',
  'warden.men@college.edu',
  'accounts@college.edu',
  'student@college.edu',
  'parent@college.edu',
]) {
  const u = db.users.find((x) => x.email === email);
  ok(`login ${email}`, !!u, u ? u.roles.join(' + ') : 'MISSING');
}

const demo = db.users.find((u) => u.email === 'student@college.edu');
const demoShort = [...held.entries()]
  .filter(([k]) => k.startsWith(demo.id + '|'))
  .map(([, v]) => Math.round((v.p / v.h) * 100))
  .filter((p) => p < 75);
ok(
  'the demo student is short in exactly one paper',
  demoShort.length === 1 && demoShort[0] >= 65,
  `${demoShort[0] ?? '—'}% — in the band where condonation is possible`,
);
ok(
  'the demo student holds an offer they qualified for',
  db.driveApplications.some((a) => a.studentId === demo.id && a.stage === 'selected') &&
    arrearsOf(demo.id) === 0 &&
    cgpaOf(demo.id) >= 7,
  `CGPA ${cgpaOf(demo.id).toFixed(2)}, ${arrearsOf(demo.id)} arrears`,
);

console.log(`\n${bad === 0 ? 'All checks passed.' : bad + ' CHECK(S) FAILED.'}`);
process.exit(bad === 0 ? 0 : 1);
