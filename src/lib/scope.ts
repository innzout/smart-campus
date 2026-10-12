import type { Database } from '@/data/types';

/**
 * Institution scoping.
 *
 * A trust that runs several institutions needs one account that can move
 * between them and every other account pinned to its own. Rather than thread an
 * id through hundreds of call sites, the whole snapshot is filtered once per
 * change and every page keeps reading `useDatabase()` as before.
 *
 * Only `group` and `colleges` survive unfiltered — the switcher needs the whole
 * list to do its job. With a single college seeded this is close to a
 * pass-through, but it is what lets a second institution be opened without
 * every figure on screen quietly becoming a group total.
 */
export function scopeDatabase(db: Database, collegeId: string): Database {
  const mine = <T>(rows: T[], keep: (row: T) => boolean) => rows.filter(keep);

  const programmeIds = new Set(
    db.programmes.filter((p) => p.collegeId === collegeId).map((p) => p.id),
  );
  const sectionIds = new Set(db.sections.filter((s) => s.collegeId === collegeId).map((s) => s.id));
  const users = db.users.filter((u) => u.collegeId === collegeId);
  const userIds = new Set(users.map((u) => u.id));
  const offeringIds = new Set(
    db.offerings.filter((o) => sectionIds.has(o.sectionId)).map((o) => o.id),
  );
  const courseIds = new Set(
    db.courses.filter((c) => programmeIds.has(c.programmeId)).map((c) => c.id),
  );
  const labIds = new Set(db.labs.filter((l) => l.collegeId === collegeId).map((l) => l.id));
  const routeIds = new Set(db.routes.filter((r) => r.collegeId === collegeId).map((r) => r.id));
  const bookIds = new Set(db.books.filter((b) => b.collegeId === collegeId).map((b) => b.id));
  const slotIds = new Set(
    db.meetingSlots.filter((m) => sectionIds.has(m.sectionId)).map((m) => m.id),
  );
  const blockIds = new Set(
    db.hostelBlocks.filter((b) => b.collegeId === collegeId).map((b) => b.id),
  );
  const roomIds = new Set(db.hostelRooms.filter((r) => blockIds.has(r.blockId)).map((r) => r.id));
  const driveIds = new Set(
    db.drives.filter((d) => d.programmeIds.some((p) => programmeIds.has(p))).map((d) => d.id),
  );

  return {
    // Shared across the whole trust.
    group: db.group,
    colleges: db.colleges,

    departments: mine(db.departments, (d) => d.collegeId === collegeId),
    programmes: mine(db.programmes, (p) => p.collegeId === collegeId),
    sections: mine(db.sections, (s) => s.collegeId === collegeId),
    courses: mine(db.courses, (c) => programmeIds.has(c.programmeId)),
    offerings: mine(db.offerings, (o) => sectionIds.has(o.sectionId)),
    users,
    mentorNotes: mine(db.mentorNotes, (m) => userIds.has(m.studentId)),
    applications: mine(db.applications, (a) => a.collegeId === collegeId),
    leaves: mine(db.leaves, (l) => userIds.has(l.staffId)),
    substitutions: mine(db.substitutions, (s) => sectionIds.has(s.sectionId)),
    timetable: mine(db.timetable, (t) => sectionIds.has(t.sectionId)),

    labs: mine(db.labs, (l) => l.collegeId === collegeId),
    labBatches: mine(db.labBatches, (b) => sectionIds.has(b.sectionId)),
    labItems: mine(db.labItems, (i) => labIds.has(i.labId)),
    labBreakages: mine(db.labBreakages, (b) => labIds.has(b.labId)),

    attendance: mine(db.attendance, (a) => offeringIds.has(a.offeringId)),
    condonations: mine(db.condonations, (c) => offeringIds.has(c.offeringId)),
    assignments: mine(db.assignments, (a) => offeringIds.has(a.offeringId)),
    assignmentStatus: mine(db.assignmentStatus, (a) => userIds.has(a.studentId)),
    internalMarks: mine(db.internalMarks, (m) => offeringIds.has(m.offeringId)),
    exams: mine(db.exams, (e) => e.collegeId === collegeId),
    results: mine(db.results, (r) => courseIds.has(r.courseId)),

    fees: mine(db.fees, (f) => userIds.has(f.studentId)),
    payments: mine(db.payments, (p) => userIds.has(p.studentId)),
    salaries: mine(db.salaries, (s) => userIds.has(s.staffId)),
    payslips: mine(db.payslips, (p) => userIds.has(p.staffId)),

    companies: mine(db.companies, (c) => c.collegeId === collegeId),
    drives: mine(db.drives, (d) => driveIds.has(d.id)),
    driveApplications: mine(db.driveApplications, (a) => userIds.has(a.studentId)),

    hostelBlocks: mine(db.hostelBlocks, (b) => b.collegeId === collegeId),
    hostelRooms: mine(db.hostelRooms, (r) => blockIds.has(r.blockId)),
    hostelAllotments: mine(db.hostelAllotments, (a) => roomIds.has(a.roomId)),

    circulars: mine(db.circulars, (c) => c.collegeId === collegeId),
    events: mine(db.events, (e) => e.collegeId === collegeId),
    requests: mine(db.requests, (r) => userIds.has(r.raisedBy)),
    meetingSlots: mine(db.meetingSlots, (m) => sectionIds.has(m.sectionId)),
    meetingBookings: mine(db.meetingBookings, (b) => slotIds.has(b.slotId)),
    visits: mine(db.visits, (v) => userIds.has(v.studentId)),

    vehicles: mine(db.vehicles, (v) => v.collegeId === collegeId),
    routes: mine(db.routes, (r) => r.collegeId === collegeId),
    studentTransport: mine(db.studentTransport, (t) => routeIds.has(t.routeId)),
    books: mine(db.books, (b) => b.collegeId === collegeId),
    loans: mine(db.loans, (l) => bookIds.has(l.bookId)),

    // A notice to everyone means everyone at that institution. Notifications
    // addressed to a person are personal rather than institutional data, and
    // every reader already filters to its own user id.
    notifications: mine(db.notifications, (n) =>
      n.userId === 'all' ? !n.collegeId || n.collegeId === collegeId : true,
    ),
    places: mine(db.places, (p) => p.collegeId === collegeId),
  };
}
