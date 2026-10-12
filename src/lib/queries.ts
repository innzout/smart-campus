import {
  ATTENDANCE_MINIMUM,
  CONDONATION_FLOOR,
  GRADE_BANDS,
  PASS_MARK,
  PG_TEACHING,
} from '@/data/types';
import type {
  AttendanceHour,
  Course,
  CourseOffering,
  Database,
  Drive,
  Role,
  Section,
  User,
} from '@/data/types';
import { daysFromToday, sum, todayISO } from './utils';
import { getActiveBranch } from './store';

/* ── lookups ───────────────────────────────────────────────────────────── */

/** The institution currently being viewed. */
export const theCollege = (db: Database) =>
  db.colleges.find((c) => c.id === getActiveBranch()) ??
  db.colleges.find((c) => c.isMain) ??
  db.colleges[0]!;

export const theGroup = (db: Database) => db.group[0]!;

/** Whether a person holds a role. Roles are a list, so never compare strings. */
export const hasRole = (user: { roles: Role[] } | undefined, ...roles: Role[]) =>
  !!user && roles.some((r) => user.roles.includes(r));

export const userById = (db: Database, id: string | undefined) =>
  id ? db.users.find((u) => u.id === id) : undefined;

export const sectionById = (db: Database, id: string | undefined) =>
  id ? db.sections.find((s) => s.id === id) : undefined;

export const programmeById = (db: Database, id: string | undefined) =>
  id ? db.programmes.find((p) => p.id === id) : undefined;

export const departmentById = (db: Database, id: string | undefined) =>
  id ? db.departments.find((d) => d.id === id) : undefined;

export const courseById = (db: Database, id: string | null | undefined) =>
  id ? db.courses.find((c) => c.id === id) : undefined;

export const offeringById = (db: Database, id: string | null | undefined) =>
  id ? db.offerings.find((o) => o.id === id) : undefined;

/** The course behind an offering, which is what most screens actually want. */
export const courseOf = (db: Database, offeringId: string | null | undefined) =>
  courseById(db, offeringById(db, offeringId)?.courseId);

export const sectionLabel = (db: Database, id: string | undefined) =>
  sectionById(db, id)?.label ?? '—';

export const studentsOf = (db: Database) => db.users.filter((u) => u.roles.includes('student'));

export const studentsInSection = (db: Database, sectionId: string) =>
  db.users
    .filter((u) => u.roles.includes('student') && u.sectionId === sectionId)
    .sort((a, b) => (a.rollNo ?? 0) - (b.rollNo ?? 0));

export const offeringsOf = (db: Database, sectionId: string) =>
  db.offerings.filter((o) => o.sectionId === sectionId);

/** The papers a particular student sits, which excludes electives they dropped. */
export const offeringsForStudent = (db: Database, studentId: string) =>
  db.offerings.filter((o) => o.enrolledIds.includes(studentId));

export const facultyOf = (db: Database) =>
  db.users.filter((u) => u.roles.includes('faculty') || u.roles.includes('tutor'));

export const staffOf = (db: Database) => db.users.filter((u) => !!u.employeeId);

/**
 * Faculty who may be given a paper. A postgraduate paper needs a Ph.D. or NET,
 * which is a university condition rather than a preference, so it is a rule.
 */
export function eligibleFaculty(db: Database, courseId: string | undefined) {
  const course = courseById(db, courseId);
  const programme = programmeById(db, course?.programmeId);
  return facultyOf(db).filter((f) => {
    if (programme?.level === 'pg') {
      if (!f.netCleared && !(f.qualification ?? '').includes('Ph.D.')) return false;
      if (f.designation && !PG_TEACHING.includes(f.designation)) return false;
    }
    return true;
  });
}

/** The sections a member of staff is responsible for — as tutor or as teacher. */
export function sectionsForFaculty(db: Database, facultyId: string): Section[] {
  const taught = new Set(
    db.offerings.filter((o) => o.facultyId === facultyId).map((o) => o.sectionId),
  );
  return db.sections.filter((s) => s.tutorId === facultyId || taught.has(s.id));
}

export const tutorOf = (db: Database, sectionId: string | undefined) =>
  userById(db, sectionById(db, sectionId)?.tutorId);

/** The students a parent account can see. */
export const childrenOf = (db: Database, parent: User) =>
  (parent.childIds ?? []).map((id) => userById(db, id)).filter((u): u is User => !!u);

/* ── attendance ────────────────────────────────────────────────────────── */

export interface CourseAttendance {
  offering: CourseOffering;
  course: Course | undefined;
  held: number;
  present: number;
  absent: number;
  od: number;
  percent: number;
  /** Below the 75% requirement. */
  short: boolean;
  /** Short, but above the floor, so condonation is still possible. */
  condonable: boolean;
}

/**
 * Attendance for one student, paper by paper.
 *
 * This is the shape a college works in. A student is not "92% present" — they
 * are fine in four papers and debarred from the fifth, and the examination hall
 * ticket is issued per paper. Rolling it into one figure hides the only fact
 * that matters.
 */
export function attendanceByCourse(db: Database, studentId: string): CourseAttendance[] {
  const mine = db.attendance.filter((a) => a.studentId === studentId);
  const byOffering = new Map<string, AttendanceHour[]>();
  for (const row of mine) {
    const list = byOffering.get(row.offeringId) ?? [];
    list.push(row);
    byOffering.set(row.offeringId, list);
  }

  return [...byOffering.entries()]
    .map(([offeringId, rows]) => {
      const offering = offeringById(db, offeringId)!;
      const absent = rows.filter((r) => r.status === 'absent').length;
      const od = rows.filter((r) => r.status === 'od').length;
      const held = rows.length;
      // On-duty counts as present, which is the whole point of granting it.
      const present = held - absent;
      const percent = held ? Math.round((present / held) * 100) : 100;
      return {
        offering,
        course: courseById(db, offering?.courseId),
        held,
        present,
        absent,
        od,
        percent,
        short: percent < ATTENDANCE_MINIMUM,
        condonable: percent < ATTENDANCE_MINIMUM && percent >= CONDONATION_FLOOR,
      };
    })
    .filter((r) => r.offering)
    .sort((a, b) => a.percent - b.percent);
}

/** The single figure a dashboard tile needs, across every paper. */
export function overallAttendance(db: Database, studentId: string) {
  const rows = db.attendance.filter((a) => a.studentId === studentId);
  const held = rows.length;
  const present = held - rows.filter((r) => r.status === 'absent').length;
  return {
    held,
    present,
    percent: held ? Math.round((present / held) * 100) : 100,
    shortIn: attendanceByCourse(db, studentId).filter((c) => c.short).length,
  };
}

/** Day-by-day attendance across all papers, for a trend line. */
export function attendanceTrend(db: Database, studentId: string, days = 12) {
  const rows = db.attendance.filter((a) => a.studentId === studentId);
  const byDate = new Map<string, { held: number; present: number }>();
  for (const r of rows) {
    const agg = byDate.get(r.date) ?? { held: 0, present: 0 };
    agg.held += 1;
    if (r.status !== 'absent') agg.present += 1;
    byDate.set(r.date, agg);
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-days)
    .map(([date, agg]) => ({
      name: date.slice(5),
      value: agg.held ? Math.round((agg.present / agg.held) * 100) : 0,
    }));
}

/** The register for one hour of one paper. */
export const registerFor = (db: Database, offeringId: string, date: string, hour: number) =>
  db.attendance.filter(
    (a) => a.offeringId === offeringId && a.date === date && a.hour === hour,
  );

/**
 * Students short of attendance anywhere in the college — the list the
 * examination cell works from before issuing hall tickets.
 */
export function studentsShortOfAttendance(db: Database) {
  const out: {
    student: User;
    section: Section | undefined;
    worst: CourseAttendance;
    shortCount: number;
  }[] = [];
  for (const student of studentsOf(db)) {
    const byCourse = attendanceByCourse(db, student.id);
    const short = byCourse.filter((c) => c.short);
    if (!short.length) continue;
    out.push({
      student,
      section: sectionById(db, student.sectionId),
      worst: short[0]!,
      shortCount: short.length,
    });
  }
  return out.sort((a, b) => a.worst.percent - b.worst.percent);
}

/** Attendance for a whole section, paper by paper, for the tutor. */
export function sectionAttendance(db: Database, sectionId: string) {
  return studentsInSection(db, sectionId).map((student) => {
    const byCourse = attendanceByCourse(db, student.id);
    const held = sum(byCourse, (c) => c.held);
    const present = sum(byCourse, (c) => c.present);
    return {
      student,
      byCourse,
      percent: held ? Math.round((present / held) * 100) : 100,
      shortIn: byCourse.filter((c) => c.short).length,
    };
  });
}

export const condonationsFor = (db: Database, studentId: string) =>
  db.condonations.filter((c) => c.studentId === studentId);

export const pendingCondonations = (db: Database) =>
  db.condonations.filter((c) => c.status === 'requested');

/* ── timetable ─────────────────────────────────────────────────────────── */

export function timetableForSection(db: Database, sectionId: string, day: number) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h! * 60 + m!;
  };

  return db.timetable
    .filter((s) => s.sectionId === sectionId && s.day === day)
    .sort((a, b) => a.hour - b.hour)
    .map((slot) => {
      const course = courseOf(db, slot.offeringId);
      const phase =
        minutes >= at(slot.start) && minutes < at(slot.end)
          ? 'now'
          : at(slot.end) <= minutes
            ? 'done'
            : 'upcoming';
      return {
        ...slot,
        label: slot.title ?? course?.title ?? 'Free hour',
        code: course?.code,
        faculty: userById(db, slot.facultyId ?? undefined)?.name ?? '—',
        phase,
      };
    });
}

/** Where a member of staff is expected today. */
export const facultyDay = (db: Database, facultyId: string, day: number) =>
  db.timetable
    .filter((s) => s.day === day && s.facultyId === facultyId)
    .sort((a, b) => a.hour - b.hour)
    .map((slot) => ({
      ...slot,
      sectionName: sectionLabel(db, slot.sectionId),
      course: courseOf(db, slot.offeringId)?.title ?? slot.title ?? '',
    }));

export interface Clash {
  sectionLabel: string;
  facultyName: string;
}

/** Whether the faculty in an hour is already in front of another section. */
export function slotClash(db: Database, hourId: string): Clash | null {
  const slot = db.timetable.find((s) => s.id === hourId);
  if (!slot?.facultyId) return null;
  const other = db.timetable.find(
    (s) => s.id !== slot.id && s.day === slot.day && s.hour === slot.hour && s.facultyId === slot.facultyId,
  );
  if (!other) return null;
  return {
    sectionLabel: sectionLabel(db, other.sectionId),
    facultyName: userById(db, slot.facultyId)?.name ?? 'The faculty member',
  };
}

export function allClashes(db: Database) {
  const seen = new Map<string, string>();
  const out: { hourId: string; facultyName: string; sectionLabel: string; other: string }[] = [];
  for (const slot of db.timetable) {
    if (!slot.facultyId || slot.kind === 'break' || slot.kind === 'lunch') continue;
    const key = `${slot.day}-${slot.hour}-${slot.facultyId}`;
    const previous = seen.get(key);
    if (previous) {
      const prev = db.timetable.find((s) => s.id === previous)!;
      out.push({
        hourId: slot.id,
        facultyName: userById(db, slot.facultyId)?.name ?? '—',
        sectionLabel: sectionLabel(db, slot.sectionId),
        other: sectionLabel(db, prev.sectionId),
      });
    } else {
      seen.set(key, slot.id);
    }
  }
  return out;
}

/** Hours a week each paper actually gets, against what the syllabus allots. */
export function hourBalance(db: Database, sectionId: string) {
  return offeringsOf(db, sectionId)
    .map((o) => {
      const course = courseById(db, o.courseId);
      return {
        offering: o,
        course,
        want: course?.hoursPerWeek ?? 0,
        got: db.timetable.filter((s) => s.sectionId === sectionId && s.offeringId === o.id).length,
      };
    })
    .filter((r) => r.course);
}

/* ── staff, leave and cover ────────────────────────────────────────────── */

export const staffOnLeave = (db: Database, date: string) =>
  db.leaves
    .filter((l) => l.status === 'approved' && l.from <= date && l.to >= date)
    .map((l) => ({ leave: l, staff: userById(db, l.staffId) }))
    .filter((r) => r.staff);

/** The hours left uncovered today, with who is genuinely free to take them. */
export function substitutionBoard(db: Database, date: string) {
  const day = new Date(date).getDay();
  const dow = day === 0 ? 7 : day;
  const absentIds = new Set(staffOnLeave(db, date).map((r) => r.staff!.id));

  const busyByHour = new Map<number, Set<string>>();
  for (const slot of db.timetable) {
    if (slot.day !== dow || !slot.facultyId) continue;
    if (!busyByHour.has(slot.hour)) busyByHour.set(slot.hour, new Set());
    busyByHour.get(slot.hour)!.add(slot.facultyId);
  }
  for (const sub of db.substitutions.filter((s) => s.date === date)) {
    const slot = db.timetable.find((s) => s.id === sub.hourId);
    if (slot) busyByHour.get(slot.hour)?.add(sub.coverFacultyId);
  }

  return db.timetable
    .filter(
      (s) =>
        s.day === dow &&
        s.kind !== 'break' &&
        s.kind !== 'lunch' &&
        s.facultyId &&
        absentIds.has(s.facultyId),
    )
    .sort((a, b) => a.hour - b.hour || a.sectionId.localeCompare(b.sectionId))
    .map((slot) => {
      const section = sectionById(db, slot.sectionId);
      const course = courseOf(db, slot.offeringId);
      const busy = busyByHour.get(slot.hour) ?? new Set<string>();
      const free = facultyOf(db).filter(
        (f) => !busy.has(f.id) && !absentIds.has(f.id) && f.id !== slot.facultyId,
      );
      // Someone who teaches the paper can take the lesson; anyone else is
      // supervision, and the distinction is worth putting on screen.
      const canTeach = free.filter((f) => f.courseIds?.includes(course?.id ?? ''));
      return {
        slot,
        section,
        course,
        absentFaculty: userById(db, slot.facultyId ?? undefined),
        cover: db.substitutions.find((s) => s.hourId === slot.id && s.date === date),
        canTeach,
        otherFree: free.filter((f) => !canTeach.includes(f)),
      };
    });
}

/* ── coursework ────────────────────────────────────────────────────────── */

export interface StudentAssignment {
  assignment: Database['assignments'][number];
  course: Course | undefined;
  submittedOn: string | null;
  marks: number | null;
  remark: string;
  daysLeft: number;
  state: 'marked' | 'submitted' | 'overdue' | 'due-soon' | 'pending';
}

export function assignmentsForStudent(db: Database, studentId: string): StudentAssignment[] {
  const mine = new Set(offeringsForStudent(db, studentId).map((o) => o.id));
  return db.assignments
    .filter((a) => mine.has(a.offeringId))
    .map((assignment) => {
      const status = db.assignmentStatus.find(
        (s) => s.assignmentId === assignment.id && s.studentId === studentId,
      );
      const daysLeft = daysFromToday(assignment.dueOn);
      const state: StudentAssignment['state'] =
        status?.marks != null
          ? 'marked'
          : status?.submittedOn
            ? 'submitted'
            : daysLeft < 0
              ? 'overdue'
              : daysLeft <= 2
                ? 'due-soon'
                : 'pending';
      return {
        assignment,
        course: courseOf(db, assignment.offeringId),
        submittedOn: status?.submittedOn ?? null,
        marks: status?.marks ?? null,
        remark: status?.remark ?? '',
        daysLeft,
        state,
      };
    })
    .sort((a, b) => a.assignment.dueOn.localeCompare(b.assignment.dueOn));
}

/* ── assessment ────────────────────────────────────────────────────────── */

export const gradeFor = (total: number) =>
  GRADE_BANDS.find((b) => total >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1]!;

/** The internal assessment a student has accumulated in one paper. */
export function ciaFor(db: Database, studentId: string, offeringId: string) {
  const rows = db.internalMarks.filter(
    (m) => m.studentId === studentId && m.offeringId === offeringId,
  );
  const held = rows.filter((r) => r.marks != null);
  return {
    components: rows,
    scored: sum(held, (r) => r.marks ?? 0),
    outOf: sum(held, (r) => r.maxMarks),
    pending: rows.length - held.length,
    max: sum(rows, (r) => r.maxMarks),
  };
}

export interface SemesterReport {
  semester: number;
  lines: {
    course: Course | undefined;
    result: Database['results'][number];
  }[];
  credits: number;
  earned: number;
  gpa: number;
  arrears: number;
}

/** Every completed semester for a student, newest first. */
export function transcript(db: Database, studentId: string): SemesterReport[] {
  const mine = db.results.filter((r) => r.studentId === studentId);
  const semesters = [...new Set(mine.map((r) => r.semester))].sort((a, b) => b - a);

  return semesters.map((semester) => {
    const rows = mine.filter((r) => r.semester === semester);
    const passed = rows.filter((r) => r.status === 'pass');
    const credits = sum(rows, (r) => r.credits);
    const earned = sum(passed, (r) => r.credits);
    // A GPA counts only the credits actually earned; a failed paper scores zero
    // until it is cleared, which is why an arrear hurts twice.
    const gpa = credits ? sum(rows, (r) => r.gradePoint * r.credits) / credits : 0;
    return {
      semester,
      lines: rows
        .map((result) => ({ course: courseById(db, result.courseId), result }))
        .sort((a, b) => (a.course?.code ?? '').localeCompare(b.course?.code ?? '')),
      credits,
      earned,
      gpa,
      arrears: rows.filter((r) => r.status === 'arrear').length,
    };
  });
}

/**
 * The two numbers that define an undergraduate: the cumulative grade point
 * average, and how many papers are still outstanding.
 */
export function academicStanding(db: Database, studentId: string) {
  const mine = db.results.filter((r) => r.studentId === studentId);
  const passed = mine.filter((r) => r.status === 'pass');
  const credits = sum(passed, (r) => r.credits);
  const arrears = mine.filter((r) => r.status === 'arrear');
  return {
    cgpa: credits ? sum(passed, (r) => r.gradePoint * r.credits) / credits : 0,
    creditsEarned: credits,
    arrears: arrears.length,
    arrearPapers: arrears.map((r) => courseById(db, r.courseId)).filter(Boolean) as Course[],
    semestersCompleted: new Set(mine.map((r) => r.semester)).size,
  };
}

/** Rank within the cohort, by CGPA. */
export function sectionRank(db: Database, studentId: string) {
  const student = userById(db, studentId);
  if (!student?.sectionId) return null;
  const peers = studentsInSection(db, student.sectionId)
    .map((s) => ({ id: s.id, cgpa: academicStanding(db, s.id).cgpa }))
    .sort((a, b) => b.cgpa - a.cgpa);
  const index = peers.findIndex((p) => p.id === studentId);
  return index === -1 ? null : { rank: index + 1, of: peers.length };
}

/** Pass percentage per paper, which is how a department judges its teaching. */
export function coursePassRates(db: Database, semester: number) {
  const rows = db.results.filter((r) => r.semester === semester);
  const byCourse = new Map<string, { pass: number; total: number }>();
  for (const r of rows) {
    const agg = byCourse.get(r.courseId) ?? { pass: 0, total: 0 };
    agg.total += 1;
    if (r.status === 'pass') agg.pass += 1;
    byCourse.set(r.courseId, agg);
  }
  return [...byCourse.entries()]
    .map(([courseId, agg]) => ({
      course: courseById(db, courseId),
      name: courseById(db, courseId)?.title ?? courseId,
      value: Math.round((agg.pass / agg.total) * 100),
      meta: `${agg.pass} of ${agg.total} passed`,
    }))
    .filter((r) => r.course)
    .sort((a, b) => a.value - b.value);
}

export { PASS_MARK };

/* ── fees ──────────────────────────────────────────────────────────────── */

export function feeSummary(db: Database, studentId: string) {
  const rows = db.fees.filter((f) => f.studentId === studentId);
  const billed = sum(rows, (f) => f.total);
  const paid = sum(rows, (f) => f.paid);
  const today = todayISO();
  return {
    rows,
    billed,
    paid,
    pending: billed - paid,
    percent: billed ? Math.round((paid / billed) * 100) : 100,
    overdue: rows.filter((f) => f.paid < f.total && f.dueOn < today),
    overdueAmount: sum(
      rows.filter((f) => f.paid < f.total && f.dueOn < today),
      (f) => f.total - f.paid,
    ),
    // The next charge still to fall due, which is what a parent plans around.
    nextDue: rows
      .filter((f) => f.paid < f.total && f.dueOn >= today)
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0],
    total: billed,
    concession: sum(rows, (f) => f.concession),
  };
}

/** Whether a single charge is paid, part paid, overdue or simply due. */
export function feeStatus(fee: Database['fees'][number]) {
  if (fee.paid >= fee.total) return 'paid' as const;
  if (fee.dueOn < todayISO()) return 'overdue' as const;
  return fee.paid > 0 ? ('partial' as const) : ('due' as const);
}

export const paymentsFor = (db: Database, studentId: string) =>
  db.payments.filter((p) => p.studentId === studentId).sort((a, b) => b.paidOn.localeCompare(a.paidOn));

export function collectionSummary(db: Database) {
  const billed = sum(db.fees, (f) => f.total);
  const paid = sum(db.fees, (f) => f.paid);
  const today = todayISO();
  const overdue = db.fees.filter((f) => f.paid < f.total && f.dueOn < today);
  return {
    billed,
    paid,
    pending: billed - paid,
    percent: billed ? Math.round((paid / billed) * 100) : 100,
    overdueAmount: sum(overdue, (f) => f.total - f.paid),
    total: billed,
    defaulters: new Set(overdue.map((f) => f.studentId)).size,
    scholarships: sum(db.fees, (f) => f.concession),
  };
}

export function duesBySection(db: Database) {
  return db.sections
    .map((section) => {
      const ids = new Set(studentsInSection(db, section.id).map((s) => s.id));
      const rows = db.fees.filter((f) => ids.has(f.studentId));
      return {
        name: section.label,
        value: sum(rows, (f) => f.total - f.paid),
        meta: `${section.label} · semester ${section.semester}`,
      };
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function defaulters(db: Database) {
  const today = todayISO();
  return studentsOf(db)
    .map((student) => {
      const summary = feeSummary(db, student.id);
      return { student, summary, section: sectionById(db, student.sectionId) };
    })
    .filter((r) => r.summary.rows.some((f) => f.paid < f.total && f.dueOn < today))
    .sort((a, b) => b.summary.pending - a.summary.pending);
}

/* ── placements ────────────────────────────────────────────────────────── */

export interface Eligibility {
  eligible: boolean;
  reasons: string[];
}

/**
 * Whether a student may register for a drive.
 *
 * A recruiter's bar is a condition of registering, not something discovered at
 * the interview, so the reason is spelled out rather than the button simply
 * being disabled.
 */
export function eligibilityFor(db: Database, studentId: string, drive: Drive): Eligibility {
  const student = userById(db, studentId);
  const standing = academicStanding(db, studentId);
  const reasons: string[] = [];

  if (!student?.programmeId || !drive.programmeIds.includes(student.programmeId)) {
    reasons.push('This drive is not open to your programme.');
  }
  if (standing.cgpa < drive.minCgpa) {
    reasons.push(`CGPA ${standing.cgpa.toFixed(2)} is below the required ${drive.minCgpa.toFixed(1)}.`);
  }
  if (standing.arrears > drive.maxArrears) {
    reasons.push(
      drive.maxArrears === 0
        ? `${standing.arrears} standing arrear${standing.arrears === 1 ? '' : 's'}; this recruiter allows none.`
        : `${standing.arrears} arrears against a limit of ${drive.maxArrears}.`,
    );
  }
  if (drive.registrationCloses < todayISO()) reasons.push('Registration has closed.');

  return { eligible: reasons.length === 0, reasons };
}

export const applicationsFor = (db: Database, studentId: string) =>
  db.driveApplications
    .filter((a) => a.studentId === studentId)
    .map((application) => {
      const drive = db.drives.find((d) => d.id === application.driveId);
      return {
        application,
        drive,
        company: db.companies.find((c) => c.id === drive?.companyId),
      };
    })
    .filter((r) => r.drive);

export const driveRoster = (db: Database, driveId: string) =>
  db.driveApplications
    .filter((a) => a.driveId === driveId)
    .map((application) => ({
      application,
      student: userById(db, application.studentId),
      section: sectionById(db, userById(db, application.studentId)?.sectionId),
      standing: academicStanding(db, application.studentId),
    }))
    .filter((r) => r.student);

export function placementSummary(db: Database) {
  const selected = db.driveApplications.filter((a) => a.stage === 'selected');
  const placedIds = new Set(selected.map((a) => a.studentId));
  // Only final-year students are counted as placeable, which is what a college
  // reports to NAAC and to parents.
  const finalYear = studentsOf(db).filter((s) => {
    const section = sectionById(db, s.sectionId);
    const programme = programmeById(db, s.programmeId);
    if (!section || !programme) return false;
    return section.semester >= programme.semesters - 1;
  });
  const packages = selected
    .map((a) => db.drives.find((d) => d.id === a.driveId)?.packageLpa ?? 0)
    .filter((p) => p > 0);
  return {
    drives: db.drives.length,
    companies: db.companies.length,
    applications: db.driveApplications.length,
    offers: selected.length,
    placed: placedIds.size,
    eligible: finalYear.length,
    percent: finalYear.length ? Math.round((placedIds.size / finalYear.length) * 100) : 0,
    highest: packages.length ? Math.max(...packages) : 0,
    average: packages.length ? packages.reduce((t, p) => t + p, 0) / packages.length : 0,
  };
}

/* ── hostel ────────────────────────────────────────────────────────────── */

export function hostelOccupancy(db: Database, blockId?: string) {
  const rooms = db.hostelRooms.filter((r) => !blockId || r.blockId === blockId);
  const allotted = db.hostelAllotments.filter((a) => a.status === 'allotted');
  const byRoom = new Map<string, number>();
  for (const a of allotted) byRoom.set(a.roomId, (byRoom.get(a.roomId) ?? 0) + 1);
  const capacity = sum(rooms, (r) => r.capacity);
  const filled = sum(rooms, (r) => byRoom.get(r.id) ?? 0);
  return {
    rooms,
    byRoom,
    capacity,
    filled,
    free: capacity - filled,
    percent: capacity ? Math.round((filled / capacity) * 100) : 0,
  };
}

export const hostelFor = (db: Database, studentId: string) => {
  const allotment = db.hostelAllotments.find((a) => a.studentId === studentId);
  if (!allotment) return null;
  const room = db.hostelRooms.find((r) => r.id === allotment.roomId);
  const block = db.hostelBlocks.find((b) => b.id === room?.blockId);
  return { allotment, room, block, warden: userById(db, block?.wardenId) };
};

export const hostelRequests = (db: Database) =>
  db.hostelAllotments
    .filter((a) => a.status === 'requested')
    .map((allotment) => ({
      allotment,
      student: userById(db, allotment.studentId),
      room: db.hostelRooms.find((r) => r.id === allotment.roomId),
    }))
    .filter((r) => r.student);

/* ── mentoring ─────────────────────────────────────────────────────────── */

/**
 * The students a member of staff mentors, with the two facts a mentor acts on:
 * are they attending, and are they passing.
 */
export function menteesOf(db: Database, mentorId: string) {
  return studentsOf(db)
    .filter((s) => s.mentorId === mentorId)
    .map((student) => ({
      student,
      section: sectionById(db, student.sectionId),
      attendance: overallAttendance(db, student.id),
      standing: academicStanding(db, student.id),
      lastNote: db.mentorNotes
        .filter((n) => n.studentId === student.id)
        .sort((a, b) => b.on.localeCompare(a.on))[0],
    }))
    .sort((a, b) => a.attendance.percent - b.attendance.percent);
}

export const notesFor = (db: Database, studentId: string) =>
  db.mentorNotes
    .filter((n) => n.studentId === studentId)
    .sort((a, b) => b.on.localeCompare(a.on));

/* ── recruitment ──────────────────────────────────────────────────────── */

export function missingDocuments(app: Database['applications'][number]) {
  const required = ['degree', 'pg', 'aadhaar', 'pan', 'bank'] as const;
  const extra: string[] = [];
  if (app.phd) extra.push('phd');
  if (app.netCleared) extra.push('net');
  if (app.experienceYears > 0) extra.push('experience');
  if (app.publications > 0) extra.push('publications');
  const held = new Set(app.documents.map((d) => d.kind));
  return [...required, ...extra].filter((k) => !held.has(k as never)) as string[];
}

export const pendingApplications = (db: Database) =>
  db.applications.filter((a) => a.status === 'submitted' || a.status === 'under-review');

/* ── laboratories ─────────────────────────────────────────────────────── */

export const batchesOf = (db: Database, sectionId: string) =>
  db.labBatches.filter((b) => b.sectionId === sectionId);

export function sectionsWithPracticals(db: Database) {
  return db.sections
    .map((section) => {
      const practicals = offeringsOf(db, section.id)
        .map((o) => courseById(db, o.courseId))
        .filter((c): c is Course => !!c && c.kind === 'practical');
      return { section, practicals, batches: batchesOf(db, section.id) };
    })
    .filter((r) => r.practicals.length > 0);
}

export const labSessions = (db: Database, labId: string) =>
  db.timetable
    .filter((s) => s.labId === labId)
    .sort((a, b) => a.day - b.day || a.hour - b.hour)
    .map((slot) => ({
      slot,
      section: sectionById(db, slot.sectionId),
      course: courseOf(db, slot.offeringId),
      batch: db.labBatches.find((b) => b.id === slot.batchId),
      faculty: userById(db, slot.facultyId ?? undefined),
    }));

export function labSummary(db: Database, labId: string) {
  const items = db.labItems.filter((i) => i.labId === labId);
  const breakages = db.labBreakages.filter((b) => b.labId === labId);
  return {
    items,
    needsRepair: items.filter((i) => i.condition !== 'good').length,
    breakages,
    unrecovered: sum(
      breakages.filter((b) => !b.recovered),
      (b) => b.amount,
    ),
    sessions: labSessions(db, labId).length,
  };
}

/* ── payroll ──────────────────────────────────────────────────────────── */

export const payrollMonths = (db: Database) =>
  [...new Set(db.payslips.map((p) => p.month))].sort((a, b) => b.localeCompare(a));

export function payrollSummary(db: Database, month: string) {
  const slips = db.payslips.filter((p) => p.month === month);
  return {
    slips: slips
      .map((slip) => ({ slip, staff: userById(db, slip.staffId) }))
      .filter((r) => r.staff)
      .sort((a, b) => b.slip.net - a.slip.net),
    headcount: slips.length,
    gross: sum(slips, (s) => s.gross),
    deductions: sum(slips, (s) => s.deductions),
    net: sum(slips, (s) => s.net),
    paid: slips.filter((s) => s.status === 'paid').length,
  };
}

export const payslipsFor = (db: Database, staffId: string) =>
  db.payslips.filter((p) => p.staffId === staffId).sort((a, b) => b.month.localeCompare(a.month));

/* ── academic structure ───────────────────────────────────────────────── */

/** Programmes grouped by department, which is how a prospectus reads. */
export function programmesByDepartment(db: Database) {
  return db.departments
    .map((department) => ({
      department,
      hod: userById(db, department.hodId),
      programmes: db.programmes.filter((p) => p.departmentId === department.id),
    }))
    .filter((d) => d.programmes.length > 0);
}

export const sectionsOfProgramme = (db: Database, programmeId: string) =>
  db.sections.filter((s) => s.programmeId === programmeId).sort((a, b) => a.semester - b.semester);

export const coursesOfProgramme = (db: Database, programmeId: string, semester?: number) =>
  db.courses
    .filter((c) => c.programmeId === programmeId && (semester == null || c.semester === semester))
    .sort((a, b) => a.semester - b.semester || a.code.localeCompare(b.code));

/** Papers with no member of staff against them. */
export const unstaffedOfferings = (db: Database) =>
  db.offerings
    .filter((o) => !o.facultyId || !db.users.some((u) => u.id === o.facultyId))
    .map((o) => ({ section: sectionById(db, o.sectionId), course: courseById(db, o.courseId) }));

/* ── circulars, events, requests, library, transport ──────────────────── */

export const visibleCirculars = (db: Database) =>
  [...db.circulars].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.postedOn.localeCompare(a.postedOn),
  );

export const upcomingEvents = (db: Database) =>
  db.events.filter((e) => e.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date));

export const allRequests = (db: Database) =>
  [...db.requests].sort((a, b) => b.createdOn.localeCompare(a.createdOn));

export const requestsFor = (db: Database, userId: string) =>
  db.requests
    .filter((r) => r.raisedBy === userId)
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn));

export const availableCopies = (db: Database, bookId: string) => {
  const book = db.books.find((b) => b.id === bookId);
  if (!book) return 0;
  const out = db.loans.filter((l) => l.bookId === bookId && !l.returnedOn).length;
  return Math.max(0, book.copies - out);
};

export const loansFor = (db: Database, studentId: string) =>
  db.loans
    .filter((l) => l.studentId === studentId)
    .map((loan) => ({
      loan,
      book: db.books.find((b) => b.id === loan.bookId),
      overdue: !loan.returnedOn && loan.dueOn < todayISO(),
      daysLeft: daysFromToday(loan.dueOn),
    }))
    .sort((a, b) => Number(!!a.loan.returnedOn) - Number(!!b.loan.returnedOn));

export const vehicleForRoute = (db: Database, routeId: string | undefined) => {
  const route = db.routes.find((r) => r.id === routeId);
  return route ? db.vehicles.find((v) => v.id === route.vehicleId) : undefined;
};

export function transportFor(db: Database, studentId: string) {
  const link = db.studentTransport.find((t) => t.studentId === studentId);
  if (!link) return null;
  const route = db.routes.find((r) => r.id === link.routeId);
  if (!route) return null;
  return {
    route,
    link,
    vehicle: vehicleForRoute(db, route.id),
    stop: link.stop,
    pickup: route.stops.find((s) => s.name === link.stop),
  };
}

export function vehicleCompliance(db: Database, withinDays = 45) {
  const today = todayISO();
  const rows: {
    vehicle: Database['vehicles'][number];
    paper: string;
    expiresOn: string;
    daysLeft: number;
  }[] = [];
  for (const vehicle of db.vehicles) {
    const papers: [string, string][] = [
      ['Fitness certificate', vehicle.fcExpiry],
      ['Insurance', vehicle.insuranceExpiry],
      ['Permit', vehicle.permitExpiry],
    ];
    for (const [paper, expiresOn] of papers) {
      const daysLeft = daysFromToday(expiresOn);
      if (expiresOn < today || daysLeft <= withinDays) rows.push({ vehicle, paper, expiresOn, daysLeft });
    }
  }
  return rows.sort((a, b) => a.daysLeft - b.daysLeft);
}

export const routeRiders = (db: Database, routeId: string) =>
  db.studentTransport
    .filter((t) => t.routeId === routeId)
    .map((t) => ({ link: t, student: userById(db, t.studentId) }))
    .filter((r) => r.student);

/* ── notifications ────────────────────────────────────────────────────── */

export const notificationsFor = (db: Database, userId: string) =>
  db.notifications
    .filter((n) => n.userId === userId || n.userId === 'all')
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn));

export const unreadCount = (db: Database, userId: string) =>
  notificationsFor(db, userId).filter((n) => !n.read).length;
