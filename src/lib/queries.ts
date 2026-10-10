import type {
  AttendanceDay,
  Database,
  Exam,
  Homework,
  SchoolClass,
  Subject,
  User,
} from '@/data/types';
import { daysFromToday, sum, todayISO } from './utils';

/* ── lookups ───────────────────────────────────────────────────────────── */

export const theSchool = (db: Database) => db.school[0]!;

export const userById = (db: Database, id: string | undefined) =>
  id ? db.users.find((u) => u.id === id) : undefined;

export const classById = (db: Database, id: string | undefined) =>
  id ? db.classes.find((c) => c.id === id) : undefined;

export const subjectById = (db: Database, id: string | null | undefined) =>
  id ? db.subjects.find((s) => s.id === id) : undefined;

export const classLabel = (db: Database, id: string | undefined) =>
  classById(db, id)?.label ?? '—';

export const studentsOf = (db: Database) => db.users.filter((u) => u.role === 'student');

export const studentsInClass = (db: Database, classId: string) =>
  db.users
    .filter((u) => u.role === 'student' && u.classId === classId)
    .sort((a, b) => (a.rollNo ?? 0) - (b.rollNo ?? 0));

export const subjectsForClass = (db: Database, classId: string) => {
  const cls = classById(db, classId);
  return cls ? db.subjects.filter((s) => s.grade === cls.grade) : [];
};

/** The classes a teacher is responsible for — as class teacher or subject teacher. */
export function classesForTeacher(db: Database, teacherId: string): SchoolClass[] {
  const taughtGrades = new Set(
    db.subjects.filter((s) => s.teacherId === teacherId).map((s) => s.grade),
  );
  return db.classes.filter(
    (c) => c.classTeacherId === teacherId || taughtGrades.has(c.grade),
  );
}

export const classTeacherOf = (db: Database, classId: string | undefined) =>
  userById(db, classById(db, classId)?.classTeacherId);

/** The students a parent account can see. */
export const childrenOf = (db: Database, parent: User) =>
  (parent.childIds ?? []).map((id) => userById(db, id)).filter((u): u is User => !!u);

/* ── attendance ────────────────────────────────────────────────────────── */

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  leave: number;
  total: number;
  percent: number;
}

export function summariseAttendance(rows: AttendanceDay[]): AttendanceSummary {
  const present = rows.filter((r) => r.status === 'present').length;
  const late = rows.filter((r) => r.status === 'late').length;
  const absent = rows.filter((r) => r.status === 'absent').length;
  const leave = rows.filter((r) => r.status === 'leave').length;
  const total = present + late + absent + leave;
  // A late arrival still counts as attendance — the child was in school.
  return {
    present,
    absent,
    late,
    leave,
    total,
    percent: total ? ((present + late) / total) * 100 : 0,
  };
}

export const attendanceFor = (db: Database, studentId: string) =>
  db.attendance
    .filter((a) => a.studentId === studentId)
    .sort((a, b) => a.date.localeCompare(b.date));

export const attendanceOn = (db: Database, date: string, classId?: string) => {
  const ids = classId ? new Set(studentsInClass(db, classId).map((s) => s.id)) : null;
  return db.attendance.filter((a) => a.date === date && (!ids || ids.has(a.studentId)));
};

/** Month-by-month percentage, for the trend chart. */
export function attendanceTrend(db: Database, studentId: string) {
  const rows = attendanceFor(db, studentId);
  const byMonth = new Map<string, AttendanceDay[]>();
  for (const r of rows) {
    const key = r.date.slice(0, 7);
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(r);
    else byMonth.set(key, [r]);
  }
  return [...byMonth.entries()].map(([month, group]) => ({
    month: new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' }),
    percent: Number(summariseAttendance(group).percent.toFixed(1)),
  }));
}

/** Whole-school attendance for a given day — the number a principal asks for. */
export function schoolAttendanceOn(db: Database, date: string) {
  return summariseAttendance(db.attendance.filter((a) => a.date === date));
}

export const ATTENDANCE_CONCERN = 85;

/** Students whose attendance has slipped — the follow-up list. */
export function studentsNeedingAttention(db: Database, classId?: string) {
  const list = classId ? studentsInClass(db, classId) : studentsOf(db);
  return list
    .map((student) => ({
      student,
      summary: summariseAttendance(attendanceFor(db, student.id)),
    }))
    .filter((r) => r.summary.percent < ATTENDANCE_CONCERN)
    .sort((a, b) => a.summary.percent - b.summary.percent);
}

/* ── timetable ─────────────────────────────────────────────────────────── */

export interface ResolvedSlot {
  id: string;
  day: number;
  period: number;
  start: string;
  end: string;
  kind: string;
  label: string;
  labelTa?: string;
  teacher: string;
  phase: 'done' | 'now' | 'upcoming';
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

export function timetableForClass(db: Database, classId: string, day: number): ResolvedSlot[] {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const isToday = day === now.getDay();

  return db.timetable
    .filter((s) => s.classId === classId && s.day === day)
    .sort((a, b) => a.period - b.period)
    .map((slot) => {
      const subject = subjectById(db, slot.subjectId);
      const phase: ResolvedSlot['phase'] = !isToday
        ? 'upcoming'
        : nowMins >= minutes(slot.start) && nowMins < minutes(slot.end)
          ? 'now'
          : nowMins >= minutes(slot.end)
            ? 'done'
            : 'upcoming';
      return {
        id: slot.id,
        day: slot.day,
        period: slot.period,
        start: slot.start,
        end: slot.end,
        kind: slot.kind,
        label: slot.title ?? subject?.name ?? 'Free period',
        labelTa: subject?.nameTa,
        teacher: subject ? (userById(db, subject.teacherId)?.name ?? '—') : '—',
        phase,
      };
    });
}

/** Where a teacher is expected today. */
export function teacherDay(db: Database, teacherId: string, day: number) {
  const mine = new Set(db.subjects.filter((s) => s.teacherId === teacherId).map((s) => s.id));
  return db.timetable
    .filter((s) => s.day === day && s.subjectId && mine.has(s.subjectId))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((slot) => ({
      ...slot,
      className: classLabel(db, slot.classId),
      subject: subjectById(db, slot.subjectId)?.name ?? '',
    }));
}

/* ── homework ──────────────────────────────────────────────────────────── */

export interface StudentHomework {
  homework: Homework;
  subject: Subject | undefined;
  done: boolean;
  remark: string;
  daysLeft: number;
  state: 'done' | 'overdue' | 'due-soon' | 'pending';
}

export function homeworkForStudent(db: Database, student: User): StudentHomework[] {
  return db.homework
    .filter((h) => h.classId === student.classId)
    .map((hw) => {
      const status = db.homeworkStatus.find(
        (s) => s.homeworkId === hw.id && s.studentId === student.id,
      );
      const daysLeft = daysFromToday(hw.dueOn);
      const done = status?.done ?? false;
      const state: StudentHomework['state'] = done
        ? 'done'
        : daysLeft < 0
          ? 'overdue'
          : daysLeft <= 1
            ? 'due-soon'
            : 'pending';
      return {
        homework: hw,
        subject: subjectById(db, hw.subjectId),
        done,
        remark: status?.remark ?? '',
        daysLeft,
        state,
      };
    })
    .sort((a, b) => a.homework.dueOn.localeCompare(b.homework.dueOn));
}

export function homeworkStats(db: Database, homeworkId: string) {
  const rows = db.homeworkStatus.filter((s) => s.homeworkId === homeworkId);
  const done = rows.filter((s) => s.done).length;
  return { total: rows.length, done, pending: rows.length - done };
}

export const homeworkForClass = (db: Database, classId: string) =>
  db.homework
    .filter((h) => h.classId === classId)
    .sort((a, b) => b.dueOn.localeCompare(a.dueOn));

/* ── exams, marks, report card ────────────────────────────────────────── */

export const examsForGrade = (db: Database, grade: number) =>
  db.exams.filter((e) => e.grade === grade).sort((a, b) => a.startsOn.localeCompare(b.startsOn));

export const publishedExamsFor = (db: Database, student: User) => {
  const cls = classById(db, student.classId);
  return cls ? examsForGrade(db, cls.grade).filter((e) => e.published) : [];
};

export interface ReportLine {
  subject: Subject | undefined;
  marks: number | null;
  maxMarks: number;
  percent: number;
  grade: string;
  remark: string;
}

/** Tamil Nadu school grading — letter grades, not credit points. */
export function gradeFor(percent: number): { grade: string; remark: string } {
  if (percent >= 91) return { grade: 'A1', remark: 'Outstanding' };
  if (percent >= 81) return { grade: 'A2', remark: 'Excellent' };
  if (percent >= 71) return { grade: 'B1', remark: 'Very good' };
  if (percent >= 61) return { grade: 'B2', remark: 'Good' };
  if (percent >= 51) return { grade: 'C1', remark: 'Satisfactory' };
  if (percent >= 41) return { grade: 'C2', remark: 'Needs improvement' };
  if (percent >= 35) return { grade: 'D', remark: 'Just passed' };
  return { grade: 'E', remark: 'Needs attention' };
}

export const PASS_MARK = 35;

export function reportCard(db: Database, studentId: string, examId: string): ReportLine[] {
  return db.marks
    .filter((m) => m.studentId === studentId && m.examId === examId)
    .map((m) => {
      const percent = m.marks == null ? 0 : (m.marks / m.maxMarks) * 100;
      const { grade, remark } = gradeFor(percent);
      return {
        subject: subjectById(db, m.subjectId),
        marks: m.marks,
        maxMarks: m.maxMarks,
        percent,
        grade,
        remark,
      };
    })
    .sort((a, b) => (a.subject?.name ?? '').localeCompare(b.subject?.name ?? ''));
}

export function reportTotals(lines: ReportLine[]) {
  const obtained = sum(lines, (l) => l.marks ?? 0);
  const max = sum(lines, (l) => l.maxMarks);
  const percent = max ? (obtained / max) * 100 : 0;
  return {
    obtained,
    max,
    percent,
    ...gradeFor(percent),
    failed: lines.filter((l) => (l.percent ?? 0) < PASS_MARK).length,
  };
}

/** Rank within the class for one exam — schools always ask for this. */
export function classRank(db: Database, student: User, examId: string) {
  if (!student.classId) return { rank: 0, outOf: 0 };
  const peers = studentsInClass(db, student.classId).map((s) => ({
    id: s.id,
    total: sum(
      db.marks.filter((m) => m.studentId === s.id && m.examId === examId),
      (m) => m.marks ?? 0,
    ),
  }));
  const ordered = peers.sort((a, b) => b.total - a.total);
  return {
    rank: ordered.findIndex((p) => p.id === student.id) + 1,
    outOf: ordered.length,
  };
}

/** Average percentage per subject for a class — shows where a class is weak. */
export function classSubjectAverages(db: Database, classId: string, examId: string) {
  const ids = new Set(studentsInClass(db, classId).map((s) => s.id));
  return subjectsForClass(db, classId).map((subject) => {
    const rows = db.marks.filter(
      (m) => m.examId === examId && m.subjectId === subject.id && ids.has(m.studentId),
    );
    const avg = rows.length
      ? rows.reduce((t, m) => t + ((m.marks ?? 0) / m.maxMarks) * 100, 0) / rows.length
      : 0;
    return { name: subject.code.replace(/\d+$/, ''), value: Number(avg.toFixed(1)), meta: subject.name };
  });
}

export function gradeDistribution(db: Database, classId: string, examId: string) {
  const buckets = new Map<string, number>([
    ['A1', 0], ['A2', 0], ['B1', 0], ['B2', 0], ['C1', 0], ['C2', 0], ['D', 0], ['E', 0],
  ]);
  for (const student of studentsInClass(db, classId)) {
    const totals = reportTotals(reportCard(db, student.id, examId));
    if (!totals.max) continue;
    buckets.set(totals.grade, (buckets.get(totals.grade) ?? 0) + 1);
  }
  return [...buckets].map(([grade, count]) => ({ name: grade, value: count }));
}

/* ── fees ──────────────────────────────────────────────────────────────── */

export function feeSummary(db: Database, studentId: string) {
  const rows = db.fees
    .filter((f) => f.studentId === studentId)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const total = sum(rows, (f) => f.total);
  const paid = sum(rows, (f) => f.paid);
  const pending = total - paid;
  const overdue = rows.filter((f) => f.paid < f.total && f.dueOn < todayISO());
  const nextDue = rows.find((f) => f.paid < f.total);
  return {
    rows,
    total,
    paid,
    pending,
    percent: total ? (paid / total) * 100 : 0,
    overdue,
    overdueAmount: sum(overdue, (f) => f.total - f.paid),
    nextDue,
  };
}

export const feeStatus = (f: { paid: number; total: number }) =>
  f.paid >= f.total ? 'paid' : f.paid > 0 ? 'partial' : 'due';

/** Whole-school collection, for the correspondent's dashboard. */
export function collectionSummary(db: Database) {
  const total = sum(db.fees, (f) => f.total);
  const paid = sum(db.fees, (f) => f.paid);
  const today = todayISO();
  const overdue = db.fees.filter((f) => f.paid < f.total && f.dueOn < today);
  return {
    total,
    paid,
    pending: total - paid,
    percent: total ? (paid / total) * 100 : 0,
    overdueAmount: sum(overdue, (f) => f.total - f.paid),
    defaulters: new Set(overdue.map((f) => f.studentId)).size,
  };
}

/** Outstanding by class — tells the office where to chase. */
export function duesByClass(db: Database) {
  return db.classes.map((cls) => {
    const ids = new Set(studentsInClass(db, cls.id).map((s) => s.id));
    const rows = db.fees.filter((f) => ids.has(f.studentId));
    return {
      name: cls.label,
      value: sum(rows, (f) => f.total - f.paid),
      meta: `Class ${cls.label}`,
    };
  });
}

export function defaulters(db: Database, classId?: string) {
  const today = todayISO();
  const list = classId ? studentsInClass(db, classId) : studentsOf(db);
  return list
    .map((student) => {
      const rows = db.fees.filter((f) => f.studentId === student.id);
      const due = rows.filter((f) => f.paid < f.total && f.dueOn < today);
      return {
        student,
        amount: sum(due, (f) => f.total - f.paid),
        heads: due.map((f) => f.head),
      };
    })
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export const paymentsFor = (db: Database, studentId: string) =>
  db.payments
    .filter((p) => p.studentId === studentId)
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn));

/* ── transport ─────────────────────────────────────────────────────────── */

export function transportFor(db: Database, studentId: string) {
  const link = db.studentTransport.find((t) => t.studentId === studentId);
  if (!link) return null;
  const route = db.routes.find((r) => r.id === link.routeId);
  if (!route) return null;
  return { route, stop: link.stop, pickup: route.stops.find((s) => s.name === link.stop) };
}

export const routeRiders = (db: Database, routeId: string) =>
  db.studentTransport
    .filter((t) => t.routeId === routeId)
    .map((t) => ({ link: t, student: userById(db, t.studentId) }))
    .filter((r) => r.student);

/* ── circulars, events, requests ──────────────────────────────────────── */

export const visibleCirculars = (db: Database) =>
  [...db.circulars].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.postedOn.localeCompare(a.postedOn),
  );

export const upcomingEvents = (db: Database) =>
  db.events.filter((e) => e.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date));

export const requestsFor = (db: Database, userId: string) =>
  db.requests.filter((r) => r.raisedBy === userId).sort((a, b) => b.createdOn.localeCompare(a.createdOn));

export const allRequests = (db: Database) =>
  [...db.requests].sort((a, b) => b.createdOn.localeCompare(a.createdOn));

/* ── library ───────────────────────────────────────────────────────────── */

export function loansFor(db: Database, studentId: string) {
  return db.loans
    .filter((l) => l.studentId === studentId)
    .map((loan) => ({
      loan,
      book: db.books.find((b) => b.id === loan.bookId),
      daysLeft: daysFromToday(loan.dueOn),
      overdue: !loan.returnedOn && daysFromToday(loan.dueOn) < 0,
    }))
    .sort((a, b) => Number(!!a.loan.returnedOn) - Number(!!b.loan.returnedOn));
}

export function availableCopies(db: Database, bookId: string) {
  const book = db.books.find((b) => b.id === bookId);
  if (!book) return 0;
  const out = db.loans.filter((l) => l.bookId === bookId && !l.returnedOn).length;
  return Math.max(0, book.copies - out);
}

/* ── notifications ─────────────────────────────────────────────────────── */

export const notificationsFor = (db: Database, userId: string) =>
  db.notifications
    .filter((n) => n.userId === userId || n.userId === 'all')
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn));

export const unreadCount = (db: Database, userId: string) =>
  notificationsFor(db, userId).filter((n) => !n.read).length;

/* ── exam helper ───────────────────────────────────────────────────────── */

export const latestPublishedExam = (db: Database, student: User): Exam | undefined =>
  publishedExamsFor(db, student).at(-1);
