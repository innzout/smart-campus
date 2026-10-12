import { getActiveBranch, mutate, newId } from './store';
import { SCHOOL_PERIODS, TEACHING_DAYS, todayISO } from './utils';
import type {
  AttendanceStatus,
  CiaComponent,
  Circular,
  CourseKind,
  Designation,
  DocumentKind,
  DriveStage,
  HelpRequest,
  LabKind,
  LeaveKind,
  Notification,
  Role,
  SalaryStructure,
} from '@/data/types';

const nowStamp = () => new Date().toISOString().slice(0, 19);

function notify(
  draft: { notifications: Notification[] },
  n: Omit<Notification, 'id' | 'createdOn' | 'read'>,
) {
  draft.notifications.unshift({
    // A notice to everyone is pinned to the institution that raised it, or it
    // would appear in another institution's inbox too.
    collegeId: n.userId === 'all' ? getActiveBranch() : undefined,
    ...n,
    id: newId('ntf'),
    createdOn: nowStamp(),
    read: false,
  });
}

/* ── attendance ────────────────────────────────────────────────────────── */

/**
 * Save the register for one hour of one paper.
 *
 * A college marks per hour and per paper, so this is scoped to an offering and
 * an hour rather than to a day. Re-saving the same hour overwrites rather than
 * duplicating, because a lecturer correcting a mistake is the normal case.
 */
export function saveAttendance(input: {
  offeringId: string;
  date: string;
  hour: number;
  statuses: Record<string, AttendanceStatus>;
  markedBy: string;
}) {
  mutate((db) => {
    for (const [studentId, status] of Object.entries(input.statuses)) {
      const existing = db.attendance.find(
        (a) =>
          a.studentId === studentId &&
          a.offeringId === input.offeringId &&
          a.date === input.date &&
          a.hour === input.hour,
      );
      if (existing) {
        existing.status = status;
        existing.markedBy = input.markedBy;
        continue;
      }
      db.attendance.push({
        id: newId('att'),
        studentId,
        offeringId: input.offeringId,
        date: input.date,
        hour: input.hour,
        status,
        markedBy: input.markedBy,
      });
    }

    // A parent hears about an absence the same day, which is the single thing
    // they most want from a college portal.
    const course = db.courses.find(
      (c) => c.id === db.offerings.find((o) => o.id === input.offeringId)?.courseId,
    );
    for (const [studentId, status] of Object.entries(input.statuses)) {
      if (status !== 'absent') continue;
      const student = db.users.find((u) => u.id === studentId);
      for (const guardianId of student?.guardianIds ?? []) {
        notify(db, {
          userId: guardianId,
          title: `${student?.name?.split(' ')[0] ?? 'Your ward'} was absent from ${course?.title ?? 'a class'}`,
          body: `Hour ${input.hour} on ${input.date}. Attendance below 75% in any paper bars a student from its examination.`,
          kind: 'attendance',
          link: '/attendance',
        });
      }
    }
  });
}

/** A student short of attendance asks for it to be condoned. */
export function requestCondonation(input: {
  studentId: string;
  offeringId: string;
  semester: number;
  percent: number;
  reason: string;
}) {
  mutate((db) => {
    const existing = db.condonations.find(
      (c) => c.studentId === input.studentId && c.offeringId === input.offeringId,
    );
    if (existing) {
      existing.reason = input.reason;
      existing.status = 'requested';
      existing.percent = input.percent;
      return;
    }
    db.condonations.push({ ...input, id: newId('cond'), status: 'requested', fee: 500 });

    for (const officer of db.users.filter((u) => u.roles.includes('controller-of-exams'))) {
      notify(db, {
        userId: officer.id,
        title: 'Condonation applied for',
        body: `${db.users.find((u) => u.id === input.studentId)?.name ?? 'A student'} is at ${input.percent}% and has applied.`,
        kind: 'attendance',
        link: '/attendance',
      });
    }
  });
}

export function decideCondonation(
  condonationId: string,
  status: 'approved' | 'rejected',
  decidedById: string,
) {
  mutate((db) => {
    const row = db.condonations.find((c) => c.id === condonationId);
    if (!row) return;
    row.status = status;
    row.decidedById = decidedById;

    // Condonation is granted on payment of the prescribed fee, so granting it
    // raises the charge rather than quietly waiving it.
    if (status === 'approved') {
      db.fees.push({
        id: newId('fee'),
        studentId: row.studentId,
        head: 'Attendance Condonation Fee',
        semester: row.semester,
        total: row.fee,
        paid: 0,
        dueOn: todayISO(),
        concession: 0,
      });
    }

    const student = db.users.find((u) => u.id === row.studentId);
    for (const id of [row.studentId, ...(student?.guardianIds ?? [])]) {
      notify(db, {
        userId: id,
        title: `Condonation ${status}`,
        body:
          status === 'approved'
            ? `Granted on payment of ₹${row.fee}. The hall ticket will be issued once the fee is paid.`
            : 'The application has not been allowed. Please meet the Controller of Examinations.',
        kind: 'attendance',
        link: '/attendance',
      });
    }
  });
}

/* ── coursework ────────────────────────────────────────────────────────── */

export function createAssignment(input: {
  offeringId: string;
  title: string;
  description: string;
  dueOn: string;
  maxMarks: number;
  assignedById: string;
}) {
  const id = newId('asg');
  mutate((db) => {
    db.assignments.push({ ...input, id, assignedOn: todayISO() });
    const offering = db.offerings.find((o) => o.id === input.offeringId);
    for (const studentId of offering?.enrolledIds ?? []) {
      db.assignmentStatus.push({
        id: newId('asgs'),
        assignmentId: id,
        studentId,
        submittedOn: null,
        marks: null,
        remark: '',
      });
      notify(db, {
        userId: studentId,
        title: `New assignment: ${input.title}`,
        body: `Due ${input.dueOn}. Out of ${input.maxMarks} marks, counting towards your internal assessment.`,
        kind: 'assignment',
        link: '/assignments',
      });
    }
  });
  return id;
}

export function submitAssignment(assignmentId: string, studentId: string) {
  mutate((db) => {
    const row = db.assignmentStatus.find(
      (s) => s.assignmentId === assignmentId && s.studentId === studentId,
    );
    if (row) row.submittedOn = todayISO();
  });
}

export function gradeAssignment(input: {
  assignmentId: string;
  studentId: string;
  marks: number;
  remark: string;
}) {
  mutate((db) => {
    const row = db.assignmentStatus.find(
      (s) => s.assignmentId === input.assignmentId && s.studentId === input.studentId,
    );
    if (!row) return;
    row.marks = input.marks;
    row.remark = input.remark;
    if (!row.submittedOn) row.submittedOn = todayISO();
  });
}

/* ── internal assessment ───────────────────────────────────────────────── */

/** Enter one internal component for a whole class in a single pass. */
export function saveInternalMarks(input: {
  offeringId: string;
  component: CiaComponent;
  marks: Record<string, number | null>;
  maxMarks: number;
}) {
  mutate((db) => {
    for (const [studentId, value] of Object.entries(input.marks)) {
      const existing = db.internalMarks.find(
        (m) =>
          m.studentId === studentId &&
          m.offeringId === input.offeringId &&
          m.component === input.component,
      );
      if (existing) {
        existing.marks = value;
        existing.maxMarks = input.maxMarks;
        continue;
      }
      db.internalMarks.push({
        id: newId('im'),
        studentId,
        offeringId: input.offeringId,
        component: input.component,
        marks: value,
        maxMarks: input.maxMarks,
      });
    }
  });
}

/** Releasing a semester's results is the Controller's act, and everyone hears. */
export function publishResults(examId: string) {
  mutate((db) => {
    const exam = db.exams.find((e) => e.id === examId);
    if (!exam) return;
    exam.published = true;

    const affected = new Set(
      db.results.filter((r) => r.examId === examId).map((r) => r.studentId),
    );
    for (const studentId of affected) {
      const student = db.users.find((u) => u.id === studentId);
      for (const id of [studentId, ...(student?.guardianIds ?? [])]) {
        notify(db, {
          userId: id,
          title: `${exam.name} results published`,
          body: 'Grades, grade points and arrears are now available under Results.',
          kind: 'result',
          link: '/results',
        });
      }
    }
  });
}

/* ── fees ──────────────────────────────────────────────────────────────── */

export function payFee(input: {
  feeId: string;
  amount: number;
  method: 'upi' | 'card' | 'netbanking' | 'cash' | 'cheque' | 'dd';
  collectedById?: string;
}) {
  const receiptNo = `SVC/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
  mutate((db) => {
    const fee = db.fees.find((f) => f.id === input.feeId);
    if (!fee) return;
    const amount = Math.min(input.amount, fee.total - fee.paid);
    fee.paid += amount;

    db.payments.unshift({
      id: newId('pay'),
      studentId: fee.studentId,
      feeId: fee.id,
      amount,
      method: input.method,
      paidOn: todayISO(),
      reference: `TXN${Date.now().toString().slice(-9)}`,
      receiptNo,
      collectedById: input.collectedById,
    });

    const student = db.users.find((u) => u.id === fee.studentId);
    for (const guardianId of student?.guardianIds ?? []) {
      notify(db, {
        userId: guardianId,
        title: `Payment received — ${fee.head}`,
        body: `₹${amount.toLocaleString('en-IN')} received. Receipt ${receiptNo}.`,
        kind: 'fee',
        link: '/fees',
      });
    }
  });
  return receiptNo;
}

/* ── circulars, requests, notifications ───────────────────────────────── */

export function postCircular(
  input: Pick<Circular, 'title' | 'body' | 'category' | 'pinned'> & { author: string },
) {
  mutate((db) => {
    db.circulars.unshift({
      ...input,
      id: newId('cir'),
      collegeId: getActiveBranch(),
      postedOn: todayISO(),
      audience: 'all',
      acknowledgedBy: [],
    });
    notify(db, {
      userId: 'all',
      title: input.title,
      body: input.body.slice(0, 160),
      kind: 'system',
      link: '/circulars',
    });
  });
}

export function acknowledgeCircular(circularId: string, userId: string) {
  mutate((db) => {
    const c = db.circulars.find((x) => x.id === circularId);
    if (c && !c.acknowledgedBy.includes(userId)) c.acknowledgedBy.push(userId);
  });
}

export function deleteCircular(circularId: string) {
  mutate((db) => {
    db.circulars = db.circulars.filter((c) => c.id !== circularId);
  });
}

export function raiseRequest(input: {
  raisedBy: string;
  aboutStudentId?: string;
  title: string;
  category: HelpRequest['category'];
  description: string;
}) {
  const ref = `REQ/${new Date().getFullYear()}/${Date.now().toString().slice(-3)}`;
  mutate((db) => {
    db.requests.unshift({
      ...input,
      id: newId('req'),
      ref,
      status: 'open',
      createdOn: todayISO(),
      updates: [],
    });
  });
  return ref;
}

export function advanceRequest(requestId: string, note: string) {
  mutate((db) => {
    const r = db.requests.find((x) => x.id === requestId);
    if (!r) return;
    r.status = r.status === 'open' ? 'in-progress' : 'resolved';
    r.updates.push({ on: todayISO(), note });
    notify(db, {
      userId: r.raisedBy,
      title: `${r.ref} — ${r.status === 'resolved' ? 'resolved' : 'in progress'}`,
      body: note,
      kind: 'system',
      link: '/requests',
    });
  });
}

export function markNotificationRead(id: string) {
  mutate((db) => {
    const n = db.notifications.find((x) => x.id === id);
    if (n) n.read = true;
  });
}

export function markAllNotificationsRead(userId: string) {
  mutate((db) => {
    for (const n of db.notifications) {
      if (n.userId === userId || n.userId === 'all') n.read = true;
    }
  });
}

export function clearNotification(id: string) {
  mutate((db) => {
    db.notifications = db.notifications.filter((n) => n.id !== id);
  });
}

/* ── placements ────────────────────────────────────────────────────────── */

export function addCompany(input: {
  name: string;
  sector: string;
  website: string;
  contactName: string;
  contactEmail: string;
}) {
  const id = newId('cmp');
  mutate((db) => {
    db.companies.push({ ...input, id, collegeId: getActiveBranch() });
  });
  return id;
}

export function createDrive(input: {
  companyId: string;
  role: string;
  packageLpa: number;
  location: string;
  programmeIds: string[];
  minCgpa: number;
  maxArrears: number;
  driveOn: string;
  registrationCloses: string;
  rounds: string[];
}) {
  const id = newId('drv');
  mutate((db) => {
    db.drives.unshift({ ...input, id, status: 'registration-open' });

    // Only students who could actually register are told about it. Announcing a
    // 7.0 CGPA drive to a student carrying arrears is noise, not news.
    const company = db.companies.find((c) => c.id === input.companyId);
    for (const student of db.users.filter(
      (u) => u.roles.includes('student') && input.programmeIds.includes(u.programmeId ?? ''),
    )) {
      const mine = db.results.filter((r) => r.studentId === student.id);
      const passed = mine.filter((r) => r.status === 'pass');
      const credits = passed.reduce((t, r) => t + r.credits, 0);
      const cgpa = credits
        ? passed.reduce((t, r) => t + r.gradePoint * r.credits, 0) / credits
        : 0;
      const arrears = mine.filter((r) => r.status === 'arrear').length;
      if (cgpa < input.minCgpa || arrears > input.maxArrears) continue;

      notify(db, {
        userId: student.id,
        title: `${company?.name ?? 'A recruiter'} is visiting — ${input.role}`,
        body: `₹${input.packageLpa} LPA at ${input.location}. You are eligible; registration closes ${input.registrationCloses}.`,
        kind: 'placement',
        link: '/placements',
      });
    }
  });
  return id;
}

export function applyToDrive(driveId: string, studentId: string) {
  mutate((db) => {
    if (db.driveApplications.some((a) => a.driveId === driveId && a.studentId === studentId)) return;
    db.driveApplications.unshift({
      id: newId('dap'),
      driveId,
      studentId,
      appliedOn: todayISO(),
      stage: 'applied',
      note: '',
    });
  });
}

/** Move a candidate through the rounds, which is what the cell does all week. */
export function advanceDriveApplication(applicationId: string, stage: DriveStage, note = '') {
  mutate((db) => {
    const app = db.driveApplications.find((a) => a.id === applicationId);
    if (!app) return;
    app.stage = stage;
    app.note = note;

    const drive = db.drives.find((d) => d.id === app.driveId);
    const company = db.companies.find((c) => c.id === drive?.companyId);
    const student = db.users.find((u) => u.id === app.studentId);

    if (stage === 'selected') {
      app.note = note || `Offer letter issued — ₹${drive?.packageLpa} LPA.`;
      for (const id of [app.studentId, ...(student?.guardianIds ?? [])]) {
        notify(db, {
          userId: id,
          title: `Selected by ${company?.name ?? 'the recruiter'}`,
          body: `${drive?.role ?? 'Offer'} — ₹${drive?.packageLpa} LPA at ${drive?.location}. Congratulations.`,
          kind: 'placement',
          link: '/placements',
        });
      }
      return;
    }

    if (stage !== 'rejected') {
      notify(db, {
        userId: app.studentId,
        title: `Shortlisted — ${company?.name ?? 'recruiter'}`,
        body: `You have gone through to the ${stage} round.`,
        kind: 'placement',
        link: '/placements',
      });
    }
  });
}

/* ── hostel ────────────────────────────────────────────────────────────── */

export function requestHostel(studentId: string, roomId: string) {
  mutate((db) => {
    const existing = db.hostelAllotments.find((a) => a.studentId === studentId);
    if (existing && existing.status !== 'vacated') return;
    db.hostelAllotments.push({
      id: newId('hal'),
      roomId,
      studentId,
      allottedOn: todayISO(),
      status: 'requested',
    });
    const room = db.hostelRooms.find((r) => r.id === roomId);
    const block = db.hostelBlocks.find((b) => b.id === room?.blockId);
    if (block) {
      notify(db, {
        userId: block.wardenId,
        title: 'Hostel place requested',
        body: `${db.users.find((u) => u.id === studentId)?.name ?? 'A student'} has asked for room ${room?.number}.`,
        kind: 'hostel',
        link: '/hostel',
      });
    }
  });
}

/** Allot or refuse a place, and raise the charge when it is granted. */
export function decideHostel(allotmentId: string, status: 'allotted' | 'rejected') {
  mutate((db) => {
    const allotment = db.hostelAllotments.find((a) => a.id === allotmentId);
    if (!allotment) return;
    allotment.status = status;
    if (status === 'allotted') allotment.allottedOn = todayISO();

    const room = db.hostelRooms.find((r) => r.id === allotment.roomId);
    const block = db.hostelBlocks.find((b) => b.id === room?.blockId);

    if (status === 'allotted' && room && block) {
      const already = db.fees.some(
        (f) => f.studentId === allotment.studentId && f.head.startsWith('Hostel'),
      );
      if (!already) {
        const due = new Date();
        due.setDate(due.getDate() + 21);
        db.fees.push({
          id: newId('fee'),
          studentId: allotment.studentId,
          head: `Hostel Room and Mess — ${block.name}`,
          semester: 0,
          total: room.rentPerYear + block.messCharge * 10,
          paid: 0,
          dueOn: due.toISOString().slice(0, 10),
          concession: 0,
        });
      }
    }

    const student = db.users.find((u) => u.id === allotment.studentId);
    for (const id of [allotment.studentId, ...(student?.guardianIds ?? [])]) {
      notify(db, {
        userId: id,
        title: status === 'allotted' ? `Hostel room ${room?.number} allotted` : 'Hostel request refused',
        body:
          status === 'allotted'
            ? `${block?.name}, room ${room?.number}. Room rent and mess charges have been added to the fee account.`
            : 'No place is available in the block at present. Please contact the warden.',
        kind: 'hostel',
        link: '/hostel',
      });
    }
  });
}

export function vacateHostel(allotmentId: string) {
  mutate((db) => {
    const a = db.hostelAllotments.find((x) => x.id === allotmentId);
    if (a) a.status = 'vacated';
  });
}

/* ── mentoring ─────────────────────────────────────────────────────────── */

export function addMentorNote(input: {
  mentorId: string;
  studentId: string;
  note: string;
  concern: 'attendance' | 'academic' | 'personal' | 'none';
}) {
  mutate((db) => {
    db.mentorNotes.unshift({ ...input, id: newId('mnt'), on: todayISO() });

    // A note raising a concern is the point at which a parent should hear.
    if (input.concern !== 'none') {
      const student = db.users.find((u) => u.id === input.studentId);
      for (const guardianId of student?.guardianIds ?? []) {
        notify(db, {
          userId: guardianId,
          title: 'Note from the mentor',
          body: input.note.slice(0, 160),
          kind: 'staff',
          link: '/mentoring',
        });
      }
    }
  });
}

/* ── academic structure ────────────────────────────────────────────────── */

export function createCourse(input: {
  code: string;
  title: string;
  programmeId: string;
  semester: number;
  kind: CourseKind;
  credits: number;
  hoursPerWeek: number;
  ciaMax: number;
  eseMax: number;
  labKind?: LabKind;
}) {
  const id = newId('crs');
  mutate((db) => {
    db.courses.push({ ...input, id });
  });
  return id;
}

/** Offer a paper to a cohort, or move it to a different member of staff. */
export function assignOffering(input: {
  sectionId: string;
  courseId: string;
  facultyId: string;
  isElective?: boolean;
}) {
  mutate((db) => {
    const existing = db.offerings.find(
      (o) => o.sectionId === input.sectionId && o.courseId === input.courseId,
    );
    const course = db.courses.find((c) => c.id === input.courseId);
    const section = db.sections.find((s) => s.id === input.sectionId);

    if (existing) {
      const previous = existing.facultyId;
      existing.facultyId = input.facultyId;
      // The timetable names the member of staff on each hour, so a reassignment
      // has to follow through or the board still shows the old name.
      for (const slot of db.timetable) {
        if (slot.offeringId === existing.id) slot.facultyId = input.facultyId;
      }
      if (previous !== input.facultyId) {
        notify(db, {
          userId: input.facultyId,
          title: `You now take ${course?.title ?? 'a paper'} for ${section?.label ?? 'a cohort'}`,
          body: 'Your timetable has been updated. The class list is on the Attendance page.',
          kind: 'staff',
          link: '/timetable',
        });
      }
      return;
    }

    const isElective = input.isElective ?? course?.kind === 'elective';
    db.offerings.push({
      id: newId('off'),
      sectionId: input.sectionId,
      courseId: input.courseId,
      facultyId: input.facultyId,
      isElective,
      // A core paper is taken by the whole cohort; an elective by whoever opts in.
      enrolledIds: isElective
        ? []
        : db.users
            .filter((u) => u.roles.includes('student') && u.sectionId === input.sectionId)
            .map((u) => u.id),
    });
  });
}

export function removeOffering(sectionId: string, courseId: string) {
  mutate((db) => {
    const offering = db.offerings.find(
      (o) => o.sectionId === sectionId && o.courseId === courseId,
    );
    if (!offering) return;
    db.offerings = db.offerings.filter((o) => o.id !== offering.id);
    for (const slot of db.timetable) {
      if (slot.offeringId === offering.id) {
        slot.offeringId = null;
        slot.facultyId = null;
        slot.title = 'Free hour';
        slot.kind = 'hour';
      }
    }
  });
}

/** A student opts into an elective, which is what makes their paper list theirs. */
export function setElective(studentId: string, offeringId: string) {
  mutate((db) => {
    const chosen = db.offerings.find((o) => o.id === offeringId);
    if (!chosen) return;
    const course = db.courses.find((c) => c.id === chosen.courseId);
    // Leaving one elective means leaving the others in the same slot.
    for (const o of db.offerings) {
      if (o.sectionId !== chosen.sectionId || !o.isElective) continue;
      const other = db.courses.find((c) => c.id === o.courseId);
      if (other?.semester !== course?.semester) continue;
      o.enrolledIds = o.enrolledIds.filter((id) => id !== studentId);
    }
    if (!chosen.enrolledIds.includes(studentId)) chosen.enrolledIds.push(studentId);
  });
}

export function createSection(input: {
  programmeId: string;
  batch: number;
  section: string;
  semester: number;
  tutorId: string;
  room: string;
  strength: number;
}) {
  const id = newId('sec');
  mutate((db) => {
    const programme = db.programmes.find((p) => p.id === input.programmeId);
    const year = Math.floor((input.semester - 1) / 2) + 1;
    const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'][year] ?? String(year);

    db.sections.push({
      id,
      collegeId: getActiveBranch(),
      programmeId: input.programmeId,
      batch: input.batch,
      section: input.section,
      semester: input.semester,
      label: `${roman} ${programme?.shortName ?? ''}${input.section === 'A' ? '' : ` — ${input.section}`}`,
      tutorId: input.tutorId,
      room: input.room,
      strength: input.strength,
    });

    const tutor = db.users.find((u) => u.id === input.tutorId);
    if (tutor && !tutor.roles.includes('tutor')) tutor.roles.push('tutor');

    // A cohort is defined by the papers of its semester, so seed them rather
    // than leaving the section empty.
    for (const course of db.courses.filter(
      (c) => c.programmeId === input.programmeId && c.semester === input.semester,
    )) {
      db.offerings.push({
        id: newId('off'),
        sectionId: id,
        courseId: course.id,
        facultyId: input.tutorId,
        isElective: course.kind === 'elective',
        enrolledIds: [],
      });
    }

    // And lay out its week, so the timetable editor has rows to fill in.
    for (const day of TEACHING_DAYS) {
      SCHOOL_PERIODS.forEach((slot, index) => {
        if (day === 6 && index > 3) return;
        db.timetable.push({
          id: newId('hr'),
          sectionId: id,
          day,
          hour: index + 1,
          start: slot.start,
          end: slot.end,
          offeringId: null,
          facultyId: null,
          room: input.room,
          title:
            slot.kind === 'break' ? 'Short Break' : slot.kind === 'lunch' ? 'Lunch Break' : 'Free hour',
          kind: slot.kind === 'period' ? 'hour' : slot.kind,
        });
      });
    }
  });
  return id;
}

export function updateSection(input: {
  sectionId: string;
  room: string;
  strength: number;
  tutorId: string;
  semester: number;
}) {
  mutate((db) => {
    const section = db.sections.find((s) => s.id === input.sectionId);
    if (!section) return;
    const previous = section.tutorId;
    section.room = input.room;
    section.strength = input.strength;
    section.tutorId = input.tutorId;
    section.semester = input.semester;

    if (previous !== input.tutorId) {
      const incoming = db.users.find((u) => u.id === input.tutorId);
      if (incoming && !incoming.roles.includes('tutor')) incoming.roles.push('tutor');
      const outgoing = db.users.find((u) => u.id === previous);
      if (outgoing && !db.sections.some((s) => s.tutorId === previous)) {
        outgoing.roles = outgoing.roles.filter((r) => r !== 'tutor');
      }
      notify(db, {
        userId: input.tutorId,
        title: `You are now tutor of ${section.label}`,
        body: `${section.room}. The cohort's register and its parents are now yours.`,
        kind: 'staff',
        link: '/attendance',
      });
    }
  });
}

/* ── timetable ─────────────────────────────────────────────────────────── */

export function setTimetableSlot(input: {
  hourId: string;
  offeringId: string | null;
  facultyId?: string | null;
}) {
  mutate((db) => {
    const slot = db.timetable.find((s) => s.id === input.hourId);
    if (!slot) return;

    if (!input.offeringId) {
      slot.offeringId = null;
      slot.facultyId = null;
      slot.kind = 'hour';
      slot.title = 'Free hour';
      slot.labId = undefined;
      slot.batchId = undefined;
      return;
    }

    const offering = db.offerings.find((o) => o.id === input.offeringId);
    const course = db.courses.find((c) => c.id === offering?.courseId);
    slot.offeringId = input.offeringId;
    slot.facultyId = input.facultyId ?? offering?.facultyId ?? null;

    if (course?.kind === 'practical') {
      const section = db.sections.find((s) => s.id === slot.sectionId);
      const programme = db.programmes.find((p) => p.id === section?.programmeId);
      const lab =
        db.labs.find((l) => l.departmentId === programme?.departmentId) ?? db.labs[0];
      slot.kind = 'lab';
      slot.title = course.title;
      slot.labId = lab?.id;
      slot.batchId = db.labBatches.find((b) => b.sectionId === slot.sectionId)?.id;
      if (lab) slot.room = lab.room;
    } else {
      slot.kind = 'hour';
      slot.title = undefined;
      slot.labId = undefined;
      slot.batchId = undefined;
    }
  });
}

export function createBlankWeek(sectionId: string) {
  let created = 0;
  mutate((db) => {
    const section = db.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const already = new Set(
      db.timetable.filter((s) => s.sectionId === sectionId).map((s) => `${s.day}-${s.hour}`),
    );
    for (const day of TEACHING_DAYS) {
      SCHOOL_PERIODS.forEach((slot, index) => {
        if (day === 6 && index > 3) return;
        const hour = index + 1;
        if (already.has(`${day}-${hour}`)) return;
        db.timetable.push({
          id: newId('hr'),
          sectionId,
          day,
          hour,
          start: slot.start,
          end: slot.end,
          offeringId: null,
          facultyId: null,
          room: section.room,
          title:
            slot.kind === 'break' ? 'Short Break' : slot.kind === 'lunch' ? 'Lunch Break' : 'Free hour',
          kind: slot.kind === 'period' ? 'hour' : slot.kind,
        });
        if (slot.kind === 'period') created += 1;
      });
    }
  });
  return created;
}

/* ── staff: recruitment, leave, cover, payroll ─────────────────────────── */

export function submitApplication(input: {
  name: string;
  email: string;
  phone: string;
  designation: Designation;
  departmentId: string;
  qualification: string;
  netCleared: boolean;
  phd: boolean;
  experienceYears: number;
  publications: number;
  courseIds: string[];
}) {
  const id = newId('app');
  mutate((db) => {
    db.applications.unshift({
      ...input,
      id,
      ref: `APP/${new Date().getFullYear()}/${db.applications.length + 40}`,
      collegeId: getActiveBranch(),
      documents: [],
      status: 'submitted',
      submittedOn: todayISO(),
      reviewNote: '',
    });
    for (const head of db.users.filter((u) => u.roles.includes('principal'))) {
      notify(db, {
        userId: head.id,
        title: `New application — ${input.name}`,
        body: `Applied for ${input.designation.replace(/-/g, ' ')}. ${input.publications} publications, ${input.experienceYears} years.`,
        kind: 'staff',
        link: '/recruitment',
      });
    }
  });
  return id;
}

export function attachDocument(applicationId: string, kind: DocumentKind, fileName: string) {
  mutate((db) => {
    const app = db.applications.find((a) => a.id === applicationId);
    if (!app) return;
    const existing = app.documents.find((d) => d.kind === kind);
    if (existing) {
      existing.fileName = fileName;
      existing.uploadedOn = todayISO();
      existing.verified = false;
      return;
    }
    app.documents.push({ kind, fileName, uploadedOn: todayISO(), verified: false });
  });
}

export function verifyDocument(applicationId: string, kind: DocumentKind, verified: boolean) {
  mutate((db) => {
    const doc = db.applications
      .find((a) => a.id === applicationId)
      ?.documents.find((d) => d.kind === kind);
    if (doc) doc.verified = verified;
  });
}

export function reviewApplication(input: {
  applicationId: string;
  status: 'under-review' | 'approved' | 'rejected';
  note: string;
  reviewedById: string;
}) {
  mutate((db) => {
    const app = db.applications.find((a) => a.id === input.applicationId);
    if (!app) return;
    app.status = input.status;
    app.reviewNote = input.note;
    app.reviewedById = input.reviewedById;
    app.reviewedOn = todayISO();

    // Approval is what creates the account. Before that an applicant has no way
    // into the system at all.
    if (input.status === 'approved' && !db.users.some((u) => u.email === app.email)) {
      const teaching: Designation[] = [
        'professor',
        'associate-professor',
        'assistant-professor',
      ];
      const roles: Role[] = teaching.includes(app.designation)
        ? ['faculty']
        : app.designation === 'librarian'
          ? ['librarian']
          : app.designation === 'lab-instructor'
            ? ['lab-instructor']
            : app.designation === 'accounts-officer'
              ? ['accounts-officer', 'payroll-officer']
              : app.designation === 'placement-officer'
                ? ['placement-officer']
                : ['office-superintendent'];

      db.users.push({
        id: newId('usr'),
        collegeId: app.collegeId,
        name: app.name,
        email: app.email,
        password: 'Welcome@123',
        roles,
        phone: app.phone,
        status: 'active',
        joinedOn: todayISO(),
        avatarHue: Math.floor(Math.random() * 360),
        employeeId: `EMP-${String(db.users.filter((u) => u.employeeId).length + 1).padStart(2, '0')}`,
        designation: app.designation,
        departmentId: app.departmentId,
        qualification: app.qualification,
        netCleared: app.netCleared,
        experienceYears: app.experienceYears,
        dateOfJoining: todayISO(),
        courseIds: app.courseIds,
      });
    }
  });
}

export function requestLeave(input: {
  staffId: string;
  kind: LeaveKind;
  from: string;
  to: string;
  reason: string;
}) {
  const id = newId('lv');
  mutate((db) => {
    db.leaves.unshift({ ...input, id, status: 'requested' });
    const staff = db.users.find((u) => u.id === input.staffId);
    for (const head of db.users.filter(
      (u) => u.roles.includes('principal') || u.roles.includes('vice-principal'),
    )) {
      notify(db, {
        userId: head.id,
        title: `Leave requested — ${staff?.name ?? 'a member of staff'}`,
        body: `${input.kind} leave from ${input.from} to ${input.to}. Cover will need arranging.`,
        kind: 'staff',
        link: '/substitutions',
      });
    }
  });
  return id;
}

export function decideLeave(leaveId: string, status: 'approved' | 'rejected', approvedById: string) {
  mutate((db) => {
    const leave = db.leaves.find((l) => l.id === leaveId);
    if (!leave) return;
    leave.status = status;
    leave.approvedById = approvedById;
    notify(db, {
      userId: leave.staffId,
      title: `Your leave was ${status}`,
      body: `${leave.from} to ${leave.to}.`,
      kind: 'staff',
      link: '/substitutions',
    });
  });
}

export function assignSubstitution(input: {
  date: string;
  hourId: string;
  coverFacultyId: string;
  assignedById: string;
  note?: string;
}) {
  mutate((db) => {
    const slot = db.timetable.find((s) => s.id === input.hourId);
    if (!slot) return;
    const existing = db.substitutions.find(
      (s) => s.hourId === input.hourId && s.date === input.date,
    );
    if (existing) {
      existing.coverFacultyId = input.coverFacultyId;
      existing.note = input.note ?? existing.note;
    } else {
      db.substitutions.push({
        id: newId('sbt'),
        date: input.date,
        hourId: input.hourId,
        sectionId: slot.sectionId,
        absentFacultyId: slot.facultyId ?? '',
        coverFacultyId: input.coverFacultyId,
        assignedById: input.assignedById,
        note: input.note ?? '',
      });
    }
    const section = db.sections.find((s) => s.id === slot.sectionId);
    notify(db, {
      userId: input.coverFacultyId,
      title: `Cover: hour ${slot.hour}, ${section?.label ?? ''}`,
      body: `${slot.start}–${slot.end} in ${slot.room}. ${input.note ?? ''}`.trim(),
      kind: 'staff',
      link: '/substitutions',
    });
  });
}

export function cancelSubstitution(id: string) {
  mutate((db) => {
    db.substitutions = db.substitutions.filter((s) => s.id !== id);
  });
}

export function runPayroll(month: string) {
  let created = 0;
  mutate((db) => {
    for (const salary of db.salaries) {
      if (db.payslips.some((p) => p.staffId === salary.staffId && p.month === month)) continue;
      const gross =
        salary.basic + salary.da + salary.hra + salary.conveyance + salary.otherAllowance;
      const deductions = salary.pf + salary.esi + salary.professionalTax;
      db.payslips.push({
        id: newId('slip'),
        staffId: salary.staffId,
        month,
        gross,
        deductions,
        net: gross - deductions,
        lopDays: 0,
        status: 'draft',
      });
      created += 1;
    }
  });
  return created;
}

export function approvePayslips(month: string) {
  mutate((db) => {
    for (const slip of db.payslips) {
      if (slip.month !== month || slip.status === 'paid') continue;
      slip.status = 'paid';
      slip.paidOn = todayISO();
      notify(db, {
        userId: slip.staffId,
        title: `Salary credited for ${month}`,
        body: `Net ₹${slip.net.toLocaleString('en-IN')}. Your payslip is available to download.`,
        kind: 'staff',
        link: '/payroll',
      });
    }
  });
}

export function payPayslip(payslipId: string) {
  mutate((db) => {
    const slip = db.payslips.find((p) => p.id === payslipId);
    if (!slip || slip.status === 'paid') return;
    slip.status = 'paid';
    slip.paidOn = todayISO();
    notify(db, {
      userId: slip.staffId,
      title: `Salary credited for ${slip.month}`,
      body: `Net ₹${slip.net.toLocaleString('en-IN')}.`,
      kind: 'staff',
      link: '/payroll',
    });
  });
}

export function revertPayslip(payslipId: string) {
  mutate((db) => {
    const slip = db.payslips.find((p) => p.id === payslipId);
    if (!slip) return;
    slip.status = 'draft';
    slip.paidOn = undefined;
  });
}

export function setLopDays(payslipId: string, lopDays: number) {
  mutate((db) => {
    const slip = db.payslips.find((p) => p.id === payslipId);
    const salary = slip ? db.salaries.find((s) => s.staffId === slip.staffId) : undefined;
    if (!slip || !salary) return;
    const full = salary.basic + salary.da + salary.hra + salary.conveyance + salary.otherAllowance;
    slip.lopDays = lopDays;
    slip.gross = full - Math.round((full / 30) * lopDays);
    slip.net = slip.gross - slip.deductions;
  });
}

export function saveSalaryStructure(input: Omit<SalaryStructure, 'id'>) {
  mutate((db) => {
    const existing = db.salaries.find((s) => s.staffId === input.staffId);
    if (existing) Object.assign(existing, input);
    else db.salaries.push({ ...input, id: newId('sal') });
  });
}

/* ── people ────────────────────────────────────────────────────────────── */

export function admitStudent(input: {
  name: string;
  sectionId: string;
  rollNo: number;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
}) {
  const studentId = newId('stu');
  const parentId = newId('par');
  mutate((db) => {
    const section = db.sections.find((s) => s.id === input.sectionId);
    const programme = db.programmes.find((p) => p.id === section?.programmeId);
    const code = (programme as { code?: string } | undefined)?.code ?? 'UGC';
    const batch = String(section?.batch ?? new Date().getFullYear()).slice(2);

    db.users.push({
      id: studentId,
      collegeId: getActiveBranch(),
      name: input.name,
      email: `${input.name.split(' ')[0]!.toLowerCase()}.${Date.now().toString(36)}@student.college.edu`,
      password: 'Student@123',
      roles: ['student'],
      registerNo: `${batch}${code}${String(input.rollNo).padStart(3, '0')}`,
      rollNo: input.rollNo,
      sectionId: input.sectionId,
      programmeId: section?.programmeId,
      dateOfBirth: input.dateOfBirth,
      guardianIds: [parentId],
      mentorId: section?.tutorId,
      phone: input.guardianPhone,
      status: 'active',
      joinedOn: todayISO(),
      avatarHue: Math.floor(Math.random() * 360),
    });

    db.users.push({
      id: parentId,
      collegeId: getActiveBranch(),
      name: input.guardianName,
      email: `parent.${Date.now().toString(36)}@gmail.com`,
      password: 'Parent@123',
      roles: ['parent'],
      childIds: [studentId],
      phone: input.guardianPhone,
      status: 'active',
      joinedOn: todayISO(),
      avatarHue: Math.floor(Math.random() * 360),
    });

    // A new admission joins every core paper of their cohort.
    for (const offering of db.offerings.filter(
      (o) => o.sectionId === input.sectionId && !o.isElective,
    )) {
      offering.enrolledIds.push(studentId);
    }
  });
  return studentId;
}

export function updateUser(id: string, patch: Partial<{ name: string; phone: string; email: string }>) {
  mutate((db) => {
    const user = db.users.find((u) => u.id === id);
    if (user) Object.assign(user, patch);
  });
}

export function updatePassword(id: string, password: string) {
  mutate((db) => {
    const user = db.users.find((u) => u.id === id);
    if (user) user.password = password;
  });
}

export function toggleUserStatus(id: string) {
  mutate((db) => {
    const user = db.users.find((u) => u.id === id);
    if (user) user.status = user.status === 'active' ? 'inactive' : 'active';
  });
}

export function setUserRoles(userId: string, roles: Role[]) {
  mutate((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user || roles.length === 0) return;
    user.roles = [...new Set(roles)];
  });
}

/* ── laboratories ──────────────────────────────────────────────────────── */

export function rebuildBatches(sectionId: string, batchCount: number) {
  mutate((db) => {
    const roll = db.users
      .filter((u) => u.roles.includes('student') && u.sectionId === sectionId)
      .sort((a, b) => (a.rollNo ?? 0) - (b.rollNo ?? 0));
    db.labBatches = db.labBatches.filter((b) => b.sectionId !== sectionId);
    for (let i = 0; i < batchCount; i++) {
      db.labBatches.push({
        id: newId('batch'),
        sectionId,
        name: `Batch ${String.fromCharCode(65 + i)}`,
        // Dealt round-robin so each batch is a mix of roll numbers.
        studentIds: roll.filter((_, idx) => idx % batchCount === i).map((s) => s.id),
      });
    }
  });
}

export function moveStudentToBatch(studentId: string, batchId: string) {
  mutate((db) => {
    const target = db.labBatches.find((b) => b.id === batchId);
    if (!target) return;
    for (const batch of db.labBatches) {
      if (batch.sectionId !== target.sectionId) continue;
      batch.studentIds = batch.studentIds.filter((id) => id !== studentId);
    }
    target.studentIds.push(studentId);
  });
}

export function setLabStaff(labId: string, inChargeId: string, assistantId: string) {
  mutate((db) => {
    const lab = db.labs.find((l) => l.id === labId);
    if (!lab) return;
    lab.inChargeId = inChargeId;
    lab.assistantId = assistantId;
    const inCharge = db.users.find((u) => u.id === inChargeId);
    if (inCharge && !inCharge.roles.includes('lab-instructor')) {
      inCharge.roles.push('lab-instructor');
    }
  });
}

export function saveLabItem(input: {
  id?: string;
  labId: string;
  name: string;
  quantity: number;
  unit: string;
  condition: 'good' | 'needs-repair' | 'condemned';
}) {
  mutate((db) => {
    const existing = input.id ? db.labItems.find((i) => i.id === input.id) : undefined;
    if (existing) {
      existing.name = input.name;
      existing.quantity = input.quantity;
      existing.unit = input.unit;
      existing.condition = input.condition;
      return;
    }
    db.labItems.push({
      id: newId('labit'),
      labId: input.labId,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      condition: input.condition,
    });
  });
}

export function recordBreakage(input: {
  labId: string;
  itemId: string;
  studentId: string;
  quantity: number;
  amount: number;
  note: string;
}) {
  mutate((db) => {
    db.labBreakages.unshift({ ...input, id: newId('brk'), date: todayISO(), recovered: false });
    const item = db.labItems.find((i) => i.id === input.itemId);
    if (item) item.quantity = Math.max(0, item.quantity - input.quantity);

    const student = db.users.find((u) => u.id === input.studentId);
    for (const guardianId of student?.guardianIds ?? []) {
      notify(db, {
        userId: guardianId,
        title: 'Laboratory breakage recorded',
        body: `${input.note || 'An item was broken during a practical.'} Recovery of ₹${input.amount} will be added to the fee account.`,
        kind: 'fee',
        link: '/fees',
      });
    }
  });
}

export function markBreakageRecovered(id: string) {
  mutate((db) => {
    const row = db.labBreakages.find((b) => b.id === id);
    if (row) row.recovered = true;
  });
}

/* ── library ───────────────────────────────────────────────────────────── */

export function addBook(input: {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  category: string;
  copies: number;
  rack: string;
  forProgrammes: string[];
  price: number;
}) {
  const id = newId('bok');
  mutate((db) => {
    db.books.unshift({
      ...input,
      id,
      collegeId: getActiveBranch(),
      accessionNo: `ACC/${String(db.books.length + 1).padStart(2, '0')}${Math.floor(Math.random() * 900 + 100)}`,
      addedOn: todayISO(),
    });
  });
  return id;
}

export function borrowBook(bookId: string, studentId: string) {
  const due = new Date();
  due.setDate(due.getDate() + 14);
  const dueOn = due.toISOString().slice(0, 10);
  mutate((db) => {
    db.loans.unshift({
      id: newId('lon'),
      bookId,
      studentId,
      borrowedOn: todayISO(),
      dueOn,
      returnedOn: null,
      fine: 0,
      renewals: 0,
      condition: 'good',
    });
  });
  return dueOn;
}

export function returnBook(loanId: string) {
  mutate((db) => {
    const loan = db.loans.find((l) => l.id === loanId);
    if (loan) loan.returnedOn = todayISO();
  });
}

export function renewLoan(loanId: string, maxRenewals = 2) {
  let ok = false;
  mutate((db) => {
    const loan = db.loans.find((l) => l.id === loanId);
    if (!loan || loan.returnedOn || loan.renewals >= maxRenewals) return;
    const due = new Date(loan.dueOn);
    due.setDate(due.getDate() + 14);
    loan.dueOn = due.toISOString().slice(0, 10);
    loan.renewals += 1;
    loan.fine = 0;
    ok = true;
  });
  return ok;
}

export function settleLoan(loanId: string, condition: 'damaged' | 'lost') {
  mutate((db) => {
    const loan = db.loans.find((l) => l.id === loanId);
    if (!loan) return;
    loan.condition = condition;
    loan.returnedOn = todayISO();
    const book = db.books.find((b) => b.id === loan.bookId);
    // A lost book is charged at full price, a damaged one at half.
    const charge = Math.round((book?.price ?? 0) * (condition === 'lost' ? 1 : 0.5));
    loan.fine += charge;
    if (condition === 'lost' && book) book.copies = Math.max(0, book.copies - 1);

    const student = db.users.find((u) => u.id === loan.studentId);
    for (const guardianId of student?.guardianIds ?? []) {
      notify(db, {
        userId: guardianId,
        title: `Library book ${condition}`,
        body: `${book?.title ?? 'A book'} — ₹${charge} has been charged to the fee account.`,
        kind: 'fee',
        link: '/fees',
      });
    }
  });
}

/* ── transport ─────────────────────────────────────────────────────────── */

export function requestTransport(studentId: string, routeId: string, stop: string) {
  mutate((db) => {
    const existing = db.studentTransport.find((t) => t.studentId === studentId);
    if (existing) {
      existing.routeId = routeId;
      existing.stop = stop;
      existing.status = 'requested';
      existing.requestedOn = todayISO();
    } else {
      db.studentTransport.push({
        id: newId('stt'),
        studentId,
        routeId,
        stop,
        status: 'requested',
        requestedOn: todayISO(),
      });
    }
    const student = db.users.find((u) => u.id === studentId);
    const route = db.routes.find((r) => r.id === routeId);
    for (const officer of db.users.filter((u) => u.roles.includes('transport-incharge'))) {
      notify(db, {
        userId: officer.id,
        title: `Transport requested — ${student?.name ?? 'a student'}`,
        body: `${route?.name ?? 'A route'}, boarding at ${stop}. Check seat availability before allotting.`,
        kind: 'transport',
        link: '/transport',
      });
    }
  });
}

export function assignTransport(studentId: string, routeId: string, stop: string) {
  mutate((db) => {
    const existing = db.studentTransport.find((t) => t.studentId === studentId);
    if (existing) {
      existing.routeId = routeId;
      existing.stop = stop;
      existing.status = 'allotted';
    } else {
      db.studentTransport.push({
        id: newId('stt'),
        studentId,
        routeId,
        stop,
        status: 'allotted',
        requestedOn: todayISO(),
      });
    }
    const route = db.routes.find((r) => r.id === routeId);
    const already = db.fees.some(
      (f) => f.studentId === studentId && f.head.startsWith('Transport'),
    );
    if (route && !already) {
      const due = new Date();
      due.setDate(due.getDate() + 21);
      db.fees.push({
        id: newId('fee'),
        studentId,
        head: 'Transport Fee',
        semester: 0,
        total: route.fee,
        paid: 0,
        dueOn: due.toISOString().slice(0, 10),
        concession: 0,
      });
    }
  });
}

export function decideTransport(linkId: string, status: 'approved' | 'allotted' | 'rejected') {
  mutate((db) => {
    const link = db.studentTransport.find((t) => t.id === linkId);
    if (!link) return;
    link.status = status;

    const student = db.users.find((u) => u.id === link.studentId);
    const route = db.routes.find((r) => r.id === link.routeId);

    if (status === 'allotted' && route) {
      const already = db.fees.some(
        (f) => f.studentId === link.studentId && f.head.startsWith('Transport'),
      );
      if (!already) {
        const due = new Date();
        due.setDate(due.getDate() + 21);
        db.fees.push({
          id: newId('fee'),
          studentId: link.studentId,
          head: 'Transport Fee',
          semester: 0,
          total: route.fee,
          paid: 0,
          dueOn: due.toISOString().slice(0, 10),
          concession: 0,
        });
      }
    }

    for (const guardianId of student?.guardianIds ?? []) {
      notify(db, {
        userId: guardianId,
        title:
          status === 'rejected'
            ? 'Transport request could not be met'
            : `Transport ${status} — ${route?.name ?? ''}`,
        body:
          status === 'rejected'
            ? 'The route is full. Please contact the office to discuss an alternative.'
            : `Boarding point ${link.stop}. The transport fee has been added to the fee account.`,
        kind: 'transport',
        link: '/transport',
      });
    }
  });
}

export function updateVehiclePapers(input: {
  vehicleId: string;
  fcExpiry?: string;
  insuranceExpiry?: string;
  permitExpiry?: string;
}) {
  mutate((db) => {
    const vehicle = db.vehicles.find((v) => v.id === input.vehicleId);
    if (!vehicle) return;
    if (input.fcExpiry) vehicle.fcExpiry = input.fcExpiry;
    if (input.insuranceExpiry) vehicle.insuranceExpiry = input.insuranceExpiry;
    if (input.permitExpiry) vehicle.permitExpiry = input.permitExpiry;
  });
}

export function saveRoute(input: {
  id?: string;
  name: string;
  vehicleId: string;
  fee: number;
  stops: { name: string; time: string }[];
}) {
  mutate((db) => {
    const existing = input.id ? db.routes.find((r) => r.id === input.id) : undefined;
    if (existing) {
      existing.name = input.name;
      existing.vehicleId = input.vehicleId;
      existing.fee = input.fee;
      existing.stops = input.stops;
      return;
    }
    db.routes.push({
      id: newId('rt'),
      collegeId: getActiveBranch(),
      name: input.name,
      vehicleId: input.vehicleId,
      fee: input.fee,
      stops: input.stops,
    });
  });
}

/* ── institutions ──────────────────────────────────────────────────────── */

export function createInstitution(input: {
  name: string;
  shortName: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  adminName: string;
  adminEmail: string;
}) {
  const collegeId = newId('col');
  const adminId = newId('usr');
  mutate((db) => {
    const main = db.colleges.find((c) => c.isMain) ?? db.colleges[0]!;
    db.colleges.push({
      id: collegeId,
      groupId: main.groupId,
      name: input.name,
      shortName: input.shortName,
      code: input.code,
      affiliatedTo: main.affiliatedTo,
      autonomous: false,
      naacGrade: 'Not yet assessed',
      tagline: main.tagline,
      taglineEn: main.taglineEn,
      address: input.address,
      city: input.city,
      phone: input.phone,
      email: input.email,
      academicYear: main.academicYear,
      currentTerm: main.currentTerm,
      isMain: false,
      seededOn: todayISO(),
    });

    db.users.push({
      id: adminId,
      collegeId,
      name: input.adminName,
      email: input.adminEmail,
      password: 'Welcome@123',
      roles: ['principal'],
      phone: input.phone,
      status: 'active',
      joinedOn: todayISO(),
      avatarHue: Math.floor(Math.random() * 360),
      employeeId: `EMP-N${db.colleges.length}`,
      designation: 'principal',
      qualification: '',
      netCleared: false,
      dateOfJoining: todayISO(),
    });

    notify(db, {
      userId: adminId,
      title: `You have been appointed Principal of ${input.shortName}`,
      body: 'Sign in with your college email address. The temporary password is Welcome@123 — change it from Settings.',
      kind: 'staff',
      link: '/settings',
    });
  });
  return { collegeId, adminId };
}
