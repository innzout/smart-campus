import type { Database } from '@/data/types';

/**
 * Branch scoping.
 *
 * A trust that runs several schools needs one account that can move between
 * them, and every other account pinned to its own. Rather than thread a school
 * id through 400 call sites, the whole snapshot is filtered once per change and
 * every page keeps reading `useDatabase()` as before.
 *
 * Only `group` and `schools` survive unfiltered — the branch switcher and the
 * Branches page need the whole list to do their job.
 *
 * This is the shape the real product enforces in the database with row-level
 * security. Doing it here is honest about being a demo, but it means a branch
 * administrator genuinely cannot see another branch's children, which is the
 * part worth getting right even in a prototype.
 */
export function scopeDatabase(db: Database, schoolId: string): Database {
  const classIds = new Set(db.classes.filter((c) => c.schoolId === schoolId).map((c) => c.id));
  const users = db.users.filter((u) => u.schoolId === schoolId);
  const userIds = new Set(users.map((u) => u.id));
  const labIds = new Set(db.labs.filter((l) => l.schoolId === schoolId).map((l) => l.id));
  const routeIds = new Set(db.routes.filter((r) => r.schoolId === schoolId).map((r) => r.id));
  const bookIds = new Set(db.books.filter((b) => b.schoolId === schoolId).map((b) => b.id));
  const slotIds = new Set(
    db.meetingSlots.filter((m) => classIds.has(m.classId)).map((m) => m.id),
  );

  // The grades this branch actually teaches — a primary branch has no business
  // showing a class 12 exam.
  const grades = new Set(db.classes.filter((c) => c.schoolId === schoolId).map((c) => c.grade));

  const mine = <T>(rows: T[], keep: (row: T) => boolean) => rows.filter(keep);

  return {
    // Shared across the whole trust.
    group: db.group,
    schools: db.schools,
    hscGroups: db.hscGroups,
    subjects: db.subjects,

    classes: mine(db.classes, (c) => c.schoolId === schoolId),
    classSubjects: mine(db.classSubjects, (cs) => classIds.has(cs.classId)),
    users,
    applications: mine(db.applications, (a) => a.schoolId === schoolId),
    leaves: mine(db.leaves, (l) => userIds.has(l.staffId)),
    substitutions: mine(db.substitutions, (s) => classIds.has(s.classId)),
    timetable: mine(db.timetable, (t) => classIds.has(t.classId)),

    labs: mine(db.labs, (l) => l.schoolId === schoolId),
    labBatches: mine(db.labBatches, (b) => classIds.has(b.classId)),
    labItems: mine(db.labItems, (i) => labIds.has(i.labId)),
    labBreakages: mine(db.labBreakages, (b) => labIds.has(b.labId)),

    attendance: mine(db.attendance, (a) => userIds.has(a.studentId)),
    homework: mine(db.homework, (h) => classIds.has(h.classId)),
    homeworkStatus: mine(db.homeworkStatus, (h) => userIds.has(h.studentId)),
    exams: mine(db.exams, (e) => grades.has(e.grade)),
    marks: mine(db.marks, (m) => userIds.has(m.studentId)),

    fees: mine(db.fees, (f) => userIds.has(f.studentId)),
    payments: mine(db.payments, (p) => userIds.has(p.studentId)),
    salaries: mine(db.salaries, (s) => userIds.has(s.staffId)),
    payslips: mine(db.payslips, (p) => userIds.has(p.staffId)),

    circulars: mine(db.circulars, (c) => c.schoolId === schoolId),
    events: mine(db.events, (e) => e.schoolId === schoolId),
    requests: mine(db.requests, (r) => userIds.has(r.raisedBy)),
    meetingSlots: mine(db.meetingSlots, (m) => classIds.has(m.classId)),
    meetingBookings: mine(db.meetingBookings, (b) => slotIds.has(b.slotId)),
    visits: mine(db.visits, (v) => userIds.has(v.studentId)),

    vehicles: mine(db.vehicles, (v) => v.schoolId === schoolId),
    routes: mine(db.routes, (r) => r.schoolId === schoolId),
    studentTransport: mine(db.studentTransport, (t) => routeIds.has(t.routeId)),
    books: mine(db.books, (b) => b.schoolId === schoolId),
    loans: mine(db.loans, (l) => bookIds.has(l.bookId)),

    // A notice to everyone means everyone at that branch, not across the trust.
    // Notifications addressed to a person are personal rather than branch data,
    // so they are left alone: every reader already filters to its own user id,
    // and dropping them emptied the trust account's inbox whenever it looked at
    // a branch it did not itself belong to.
    notifications: mine(db.notifications, (n) =>
      n.userId === 'all' ? !n.schoolId || n.schoolId === schoolId : true,
    ),
    places: mine(db.places, (p) => p.schoolId === schoolId),
  };
}
