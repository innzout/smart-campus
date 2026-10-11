import { getActiveBranch, mutate, newId } from './store';
import { SCHOOL_PERIODS, TEACHING_DAYS, classSitsFor, todayISO } from './utils';
import type {
  AttendanceStatus,
  Circular,
  Designation,
  DocumentKind,
  HelpRequest,
  LabKind,
  LeaveKind,
  Notification,
  Role,
  SalaryStructure,
  Stage,
  SubjectKind,
} from '@/data/types';

const nowStamp = () => new Date().toISOString().slice(0, 19);

function notify(
  draft: { notifications: Notification[] },
  n: Omit<Notification, 'id' | 'createdOn' | 'read'>,
) {
  draft.notifications.unshift({
    // A notice to everyone is pinned to the branch that raised it, or it would
    // appear in the other branch's inbox too.
    schoolId: n.userId === 'all' ? getActiveBranch() : undefined,
    ...n,
    id: newId('ntf'),
    createdOn: nowStamp(),
    read: false,
  });
}

/* ── attendance ────────────────────────────────────────────────────────── */

/**
 * Save the daily register for a class. Schools mark once a day, so the whole
 * class is written in one go and re-saving the same day overwrites rather than
 * duplicating.
 */
export function saveAttendance(input: {
  date: string;
  classId: string;
  statuses: Record<string, AttendanceStatus>;
  markedBy: string;
}) {
  mutate((db) => {
    for (const [studentId, status] of Object.entries(input.statuses)) {
      const id = `att-${studentId}-${input.date}`;
      const existing = db.attendance.find((a) => a.id === id);
      if (existing) {
        existing.status = status;
        existing.markedBy = input.markedBy;
      } else {
        db.attendance.push({ id, studentId, date: input.date, status, markedBy: input.markedBy });
      }

      // Parents are told the same day, which is the feature they actually value.
      if (status === 'absent') {
        const student = db.users.find((u) => u.id === studentId);
        for (const guardianId of student?.guardianIds ?? []) {
          notify(db, {
            userId: guardianId,
            title: `${student?.name.split(' ')[0]} was marked absent`,
            body: 'Your child was not present at morning attendance. Please contact the class teacher if this is unexpected.',
            kind: 'attendance',
            link: '/attendance',
          });
        }
      }
    }
  });
}

/* ── homework ──────────────────────────────────────────────────────────── */

export function createHomework(input: {
  classId: string;
  subjectId: string;
  title: string;
  description: string;
  dueOn: string;
  assignedById: string;
}) {
  const id = newId('hw');
  mutate((db) => {
    db.homework.push({ ...input, id, assignedOn: todayISO() });

    const students = db.users.filter((u) => u.roles.includes('student') && u.classId === input.classId);
    for (const student of students) {
      db.homeworkStatus.push({
        id: newId('hws'),
        homeworkId: id,
        studentId: student.id,
        done: false,
        submittedOn: null,
        remark: '',
      });
      for (const guardianId of student.guardianIds ?? []) {
        notify(db, {
          userId: guardianId,
          title: `New homework: ${input.title}`,
          body: `Due ${input.dueOn}.`,
          kind: 'homework',
          link: '/homework',
        });
      }
    }
  });
  return id;
}

export function setHomeworkDone(homeworkId: string, studentId: string, done: boolean) {
  mutate((db) => {
    const row = db.homeworkStatus.find(
      (s) => s.homeworkId === homeworkId && s.studentId === studentId,
    );
    if (!row) return;
    row.done = done;
    row.submittedOn = done ? todayISO() : null;
  });
}

export function remarkHomework(homeworkId: string, studentId: string, remark: string) {
  mutate((db) => {
    const row = db.homeworkStatus.find(
      (s) => s.homeworkId === homeworkId && s.studentId === studentId,
    );
    if (row) row.remark = remark;
  });
}

/* ── marks ─────────────────────────────────────────────────────────────── */

export function saveMarks(input: {
  examId: string;
  subjectId: string;
  marks: Record<string, number | null>;
}) {
  mutate((db) => {
    for (const [studentId, value] of Object.entries(input.marks)) {
      const existing = db.marks.find(
        (m) => m.studentId === studentId && m.examId === input.examId && m.subjectId === input.subjectId,
      );
      if (existing) existing.marks = value;
      else
        db.marks.push({
          id: newId('mk'),
          studentId,
          examId: input.examId,
          subjectId: input.subjectId,
          marks: value,
          // Higher Secondary science is out of 70 theory, not 100.
          maxMarks: db.subjects.find((sub) => sub.id === input.subjectId)?.maxMarks ?? 100,
          practicalMarks: null,
        });
    }
  });
}

/** Releasing results is a deliberate act — and every parent hears about it. */
export function publishExam(examId: string) {
  mutate((db) => {
    const exam = db.exams.find((e) => e.id === examId);
    if (!exam) return;
    exam.published = true;

    const gradeStudents = db.users.filter((u) => {
      if (!u.roles.includes('student')) return false;
      const cls = db.classes.find((c) => c.id === u.classId);
      return cls?.grade === exam.grade;
    });

    for (const student of gradeStudents) {
      for (const guardianId of student.guardianIds ?? []) {
        notify(db, {
          userId: guardianId,
          title: `${exam.name} report card published`,
          body: 'The report card is now available to view and download.',
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
  studentId: string;
  amount: number;
  method: 'upi' | 'card' | 'netbanking' | 'cash' | 'cheque';
}) {
  const year = new Date().getFullYear();
  const reference = `TXN${year}${Math.floor(100000 + Math.random() * 899999)}`;
  let receiptNo = '';

  mutate((db) => {
    const fee = db.fees.find((f) => f.id === input.feeId);
    if (!fee) return;
    fee.paid = Math.min(fee.total, fee.paid + input.amount);
    receiptNo = `RCP/${year}/${db.payments.length + 101}`;

    db.payments.unshift({
      id: newId('pay'),
      studentId: input.studentId,
      feeId: input.feeId,
      amount: input.amount,
      method: input.method,
      paidOn: todayISO(),
      reference,
      receiptNo,
    });

    const student = db.users.find((u) => u.id === input.studentId);
    for (const userId of [...(student?.guardianIds ?? []), input.studentId]) {
      notify(db, {
        userId,
        title: 'Payment received',
        body: `${fee.head} — receipt ${receiptNo}. Thank you.`,
        kind: 'fee',
        link: '/fees',
      });
    }
  });

  return { reference, receiptNo };
}

/* ── circulars ─────────────────────────────────────────────────────────── */

export function postCircular(
  input: Pick<Circular, 'title' | 'body' | 'category' | 'pinned'> & { author: string },
) {
  mutate((db) => {
    db.circulars.unshift({
      ...input,
      id: newId('cir'),
      schoolId: getActiveBranch(),
      postedOn: todayISO(),
      audience: 'all',
      acknowledgedBy: [],
    });
    notify(db, {
      userId: 'all',
      title: input.title,
      body: input.body.slice(0, 140),
      kind: 'system',
      link: '/circulars',
    });
  });
}

/** Acknowledgement is what makes a circular auditable — "who has seen this". */
export function acknowledgeCircular(circularId: string, userId: string) {
  mutate((db) => {
    const circular = db.circulars.find((c) => c.id === circularId);
    if (circular && !circular.acknowledgedBy.includes(userId)) {
      circular.acknowledgedBy.push(userId);
    }
  });
}

export function deleteCircular(id: string) {
  mutate((db) => {
    db.circulars = db.circulars.filter((c) => c.id !== id);
  });
}

/* ── help desk ─────────────────────────────────────────────────────────── */

export function raiseRequest(input: {
  raisedBy: string;
  aboutStudentId?: string;
  title: string;
  category: HelpRequest['category'];
  description: string;
}) {
  const year = new Date().getFullYear();
  const ref = `REQ/${year}/${Math.floor(200 + Math.random() * 799)}`;
  mutate((db) => {
    db.requests.unshift({
      ...input,
      id: newId('req'),
      ref,
      status: 'open',
      createdOn: todayISO(),
      updates: [],
    });
    notify(db, {
      userId: input.raisedBy,
      title: `Request ${ref} received`,
      body: 'The school office will respond within two working days.',
      kind: 'system',
      link: '/requests',
    });
  });
  return ref;
}

export function advanceRequest(id: string, status: HelpRequest['status'], note: string) {
  mutate((db) => {
    const request = db.requests.find((r) => r.id === id);
    if (!request) return;
    request.status = status;
    request.updates.push({ on: todayISO(), note });
    notify(db, {
      userId: request.raisedBy,
      title: `${request.ref} — ${status === 'resolved' ? 'resolved' : 'update'}`,
      body: note,
      kind: 'system',
      link: '/requests',
    });
  });
}

/* ── library ───────────────────────────────────────────────────────────── */

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

/* ── transport ─────────────────────────────────────────────────────────── */

export function assignTransport(studentId: string, routeId: string, stop: string) {
  mutate((db) => {
    const existing = db.studentTransport.find((t) => t.studentId === studentId);
    if (existing) {
      existing.routeId = routeId;
      existing.stop = stop;
    } else {
      db.studentTransport.push({
        id: newId('stt'),
        studentId,
        routeId,
        stop,
        // An allotment made by the office is already approved.
        status: 'allotted',
        requestedOn: todayISO(),
      });
    }
  });
}

/* ── notifications ─────────────────────────────────────────────────────── */

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

/* ── people ────────────────────────────────────────────────────────────── */

export function admitStudent(input: {
  name: string;
  classId: string;
  rollNo: number;
  guardianName: string;
  guardianPhone: string;
  dateOfBirth: string;
}) {
  const studentId = newId('stu');
  const parentId = newId('par');
  const year = new Date().getFullYear();

  mutate((db) => {
    db.users.push({
      id: studentId,
      name: input.name,
      email: `${input.name.split(' ')[0]!.toLowerCase()}.${Date.now().toString(36)}@student.school.edu`,
      password: 'Student@123',
      roles: ['student'],
      schoolId: getActiveBranch(),
      admissionNo: `SVM${year}${1000 + db.users.filter((u) => u.roles.includes('student')).length}`,
      rollNo: input.rollNo,
      classId: input.classId,
      dateOfBirth: input.dateOfBirth,
      guardianIds: [parentId],
      phone: input.guardianPhone,
      status: 'active',
      joinedOn: todayISO(),
      avatarHue: Math.floor(Math.random() * 360),
    });

    db.users.push({
      id: parentId,
      name: input.guardianName,
      email: `parent.${Date.now().toString(36)}@gmail.com`,
      password: 'Parent@123',
      roles: ['parent'],
      schoolId: getActiveBranch(),
      childIds: [studentId],
      phone: input.guardianPhone,
      status: 'active',
      joinedOn: todayISO(),
      avatarHue: Math.floor(Math.random() * 360),
    });
  });

  return studentId;
}

export function updateUser(id: string, patch: Partial<{ name: string; email: string; phone: string; password: string; status: 'active' | 'inactive'; role: Role }>) {
  mutate((db) => {
    const u = db.users.find((x) => x.id === id);
    if (u) Object.assign(u, patch);
  });
}

export function toggleUserStatus(id: string) {
  mutate((db) => {
    const u = db.users.find((x) => x.id === id);
    if (u) u.status = u.status === 'active' ? 'inactive' : 'active';
  });
}

/* ── academic setup ────────────────────────────────────────────────────── */

/**
 * Open a new class-section. The Higher Secondary group decides the subject set,
 * so it is required from class 11 and meaningless below it.
 */
export function createClass(input: {
  grade: number;
  section: string;
  classTeacherId: string;
  room: string;
  hscGroupId?: string;
  strength: number;
}) {
  const id = newId('cls');
  mutate((db) => {
    const stage: Stage =
      input.grade <= 5
        ? 'primary'
        : input.grade <= 8
          ? 'middle'
          : input.grade <= 10
            ? 'secondary'
            : 'higher-secondary';

    db.classes.push({
      id,
      schoolId: getActiveBranch(),
      grade: input.grade,
      section: input.section,
      label: `${input.grade}-${input.section}`,
      stage,
      hscGroupId: stage === 'higher-secondary' ? input.hscGroupId : undefined,
      classTeacherId: input.classTeacherId,
      room: input.room,
      strength: input.strength,
    });

    // Taking a class makes someone a class teacher, whatever else they hold.
    const teacher = db.users.find((u) => u.id === input.classTeacherId);
    if (teacher && !teacher.roles.includes('class-teacher')) teacher.roles.push('class-teacher');

    // A Higher Secondary class is defined by its group, so seed the subject set
    // from it rather than leaving the class empty.
    if (stage === 'higher-secondary' && input.hscGroupId) {
      const grp = db.hscGroups.find((g) => g.id === input.hscGroupId);
      for (const subjectId of ['sub-tam3', 'sub-eng3', ...(grp?.subjectIds ?? [])]) {
        db.classSubjects.push({
          id: newId('csub'),
          classId: id,
          subjectId,
          teacherId: input.classTeacherId,
          // The same weighting the rest of the school uses: a language gets six
          // periods, games two, everything else five.
          periodsPerWeek:
            db.subjects.find((x) => x.id === subjectId)?.kind === 'language' ? 6 : 5,
        });
      }
    }

    // Lay out the blank week inline, so the class is schedulable the moment it
    // exists rather than showing a period editor with no rows in it.
    for (const day of TEACHING_DAYS) {
      SCHOOL_PERIODS.forEach((slot, index) => {
        if (!classSitsFor(input.grade, day, index)) return;
        db.timetable.push({
          id: newId('slot'),
          classId: id,
          day,
          period: index + 1,
          start: slot.start,
          end: slot.end,
          subjectId: null,
          teacherId: null,
          title:
            slot.kind === 'break'
              ? 'Short Break'
              : slot.kind === 'lunch'
                ? 'Lunch Break'
                : 'Free period',
          kind: slot.kind,
        });
      });
    }
  });
  return id;
}

/** Offer a subject to a class, or move it to a different teacher. */
export function assignClassSubject(input: {
  classId: string;
  subjectId: string;
  teacherId: string;
  periodsPerWeek?: number;
}) {
  mutate((db) => {
    const existing = db.classSubjects.find(
      (cs) => cs.classId === input.classId && cs.subjectId === input.subjectId,
    );
    if (existing) {
      const previous = existing.teacherId;
      existing.teacherId = input.teacherId;
      if (input.periodsPerWeek) existing.periodsPerWeek = input.periodsPerWeek;

      // The timetable names the teacher on each period, so a reassignment has
      // to follow through or the board still shows the old name.
      for (const slot of db.timetable) {
        if (slot.classId === input.classId && slot.subjectId === input.subjectId) {
          slot.teacherId = input.teacherId;
        }
      }

      if (previous !== input.teacherId) {
        const cls = db.classes.find((c) => c.id === input.classId);
        const subject = db.subjects.find((s) => s.id === input.subjectId);
        notify(db, {
          userId: input.teacherId,
          title: `You now take ${subject?.name ?? 'a subject'} for ${cls?.label ?? 'a class'}`,
          body: 'Your timetable has been updated. Please collect the class record from the office.',
          kind: 'staff',
          link: '/timetable',
        });
      }
      return;
    }

    db.classSubjects.push({
      id: newId('csub'),
      classId: input.classId,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      periodsPerWeek: input.periodsPerWeek ?? 5,
    });
  });
}

/** Withdraw a subject from a class. */
export function removeClassSubject(classId: string, subjectId: string) {
  mutate((db) => {
    db.classSubjects = db.classSubjects.filter(
      (cs) => !(cs.classId === classId && cs.subjectId === subjectId),
    );
    for (const slot of db.timetable) {
      if (slot.classId === classId && slot.subjectId === subjectId) {
        slot.subjectId = null;
        slot.teacherId = null;
        slot.title = 'Free period';
      }
    }
  });
}

/** Add a subject to the school's own catalogue. */
export function createSubject(input: {
  code: string;
  name: string;
  nameTa?: string;
  kind: SubjectKind;
  grades: number[];
  maxMarks: number;
  hasPractical: boolean;
  practicalMarks: number;
  labKind?: LabKind;
}) {
  const id = newId('sub');
  mutate((db) => {
    db.subjects.push({ ...input, id });
  });
  return id;
}

/* ── branches ──────────────────────────────────────────────────────────── */

/**
 * Open a branch and appoint its administrator. In the real product each branch
 * is a tenant isolated at the database level; here the branch is a record and
 * that isolation is not enforced, which the screen says plainly.
 */
export function createBranch(input: {
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
  const schoolId = newId('sch');
  const adminId = newId('usr');
  mutate((db) => {
    // New branches inherit the board and motto from the flagship campus.
    const main = db.schools.find((x) => x.isMain) ?? db.schools[0]!;
    db.schools.push({
      id: schoolId,
      groupId: main.groupId,
      name: input.name,
      shortName: input.shortName,
      code: input.code,
      board: main.board,
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
      schoolId,
      name: input.adminName,
      email: input.adminEmail,
      password: 'Branch@123',
      roles: ['correspondent'],
      phone: input.phone,
      status: 'active',
      joinedOn: todayISO(),
      avatarHue: Math.floor(Math.random() * 360),
      employeeId: `EMP-B${db.schools.length}`,
      designation: 'correspondent',
      qualification: '',
      tetCleared: false,
      dateOfJoining: todayISO(),
    });

    notify(db, {
      userId: adminId,
      title: `You have been appointed administrator of ${input.shortName}`,
      body: 'Sign in with your school email address. The temporary password is Branch@123 — change it from Settings.',
      kind: 'staff',
      link: '/settings',
    });
  });
  return { schoolId, adminId };
}

/* ── staff recruitment ─────────────────────────────────────────────────── */

/** An applicant files their particulars; documents are attached separately. */
export function submitApplication(input: {
  name: string;
  email: string;
  phone: string;
  designation: Designation;
  qualification: string;
  tetCleared: boolean;
  experienceYears: number;
  subjectIds: string[];
}) {
  const id = newId('app');
  mutate((db) => {
    db.applications.unshift({
      ...input,
      id,
      ref: `APP/${new Date().getFullYear()}/${db.applications.length + 40}`,
      schoolId: getActiveBranch(),
      documents: [],
      status: 'submitted',
      submittedOn: todayISO(),
      reviewNote: '',
    });

    // The Principal decides on appointments, so they are the one told.
    for (const head of db.users.filter((u) => u.roles.includes('principal'))) {
      notify(db, {
        userId: head.id,
        title: `New application — ${input.name}`,
        body: `Applied for ${input.designation.replace(/-/g, ' ')}. Review the file and the documents attached.`,
        kind: 'staff',
        link: '/recruitment',
      });
    }
  });
  return id;
}

/**
 * Attach a document to an application. The file itself is not stored — this
 * prototype keeps only the name, because a scanned B.Ed certificate runs to
 * about two megabytes and nine of them per applicant will not fit in a browser.
 */
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

    // Approval is what actually creates the staff account — before that the
    // applicant has no way into the system at all.
    if (input.status === 'approved' && !db.users.some((u) => u.email === app.email)) {
      const teaching: Designation[] = ['sgt', 'bt-assistant', 'pg-assistant', 'pet'];
      const roles: Role[] = teaching.includes(app.designation)
        ? ['subject-teacher']
        : app.designation === 'librarian'
          ? ['librarian']
          : app.designation === 'lab-assistant'
            ? ['lab-assistant']
            : app.designation === 'accounts-officer'
              ? ['accounts-officer', 'payroll-officer']
              : ['office-superintendent'];

      const staffCount = db.users.filter((u) => u.employeeId).length;
      db.users.push({
        id: newId('usr'),
        schoolId: app.schoolId,
        name: app.name,
        email: app.email,
        password: 'Welcome@123',
        roles,
        phone: app.phone,
        status: 'active',
        joinedOn: todayISO(),
        avatarHue: Math.floor(Math.random() * 360),
        employeeId: `EMP-${String(staffCount + 1).padStart(2, '0')}`,
        designation: app.designation,
        qualification: app.qualification,
        tetCleared: app.tetCleared,
        dateOfJoining: todayISO(),
        subjectIds: app.subjectIds,
      });
    }
  });
}

/* ── leave and substitution ────────────────────────────────────────────── */

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

export function decideLeave(
  leaveId: string,
  status: 'approved' | 'rejected',
  approvedById: string,
) {
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

/** Hand one period to a teacher who is free for it. */
export function assignSubstitution(input: {
  date: string;
  slotId: string;
  coverTeacherId: string;
  assignedById: string;
  note?: string;
}) {
  mutate((db) => {
    const slot = db.timetable.find((s) => s.id === input.slotId);
    if (!slot) return;

    const existing = db.substitutions.find(
      (s) => s.slotId === input.slotId && s.date === input.date,
    );
    if (existing) {
      existing.coverTeacherId = input.coverTeacherId;
      existing.note = input.note ?? existing.note;
    } else {
      db.substitutions.push({
        id: newId('sbt'),
        date: input.date,
        slotId: input.slotId,
        classId: slot.classId,
        absentTeacherId: slot.teacherId ?? '',
        coverTeacherId: input.coverTeacherId,
        assignedById: input.assignedById,
        note: input.note ?? '',
      });
    }

    const cls = db.classes.find((c) => c.id === slot.classId);
    notify(db, {
      userId: input.coverTeacherId,
      title: `Cover: period ${slot.period}, ${cls?.label ?? ''}`,
      body: `${slot.start}–${slot.end} in ${cls?.room ?? 'the classroom'}. ${input.note ?? ''}`.trim(),
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

/* ── laboratories ──────────────────────────────────────────────────────── */

/**
 * Split a class into practical batches. The lab's bench count is the real
 * constraint, so the number of batches follows from capacity, not from taste.
 */
export function rebuildBatches(classId: string, batchCount: number) {
  mutate((db) => {
    const roll = db.users
      .filter((u) => u.roles.includes('student') && u.classId === classId)
      .sort((a, b) => (a.rollNo ?? 0) - (b.rollNo ?? 0));

    db.labBatches = db.labBatches.filter((b) => b.classId !== classId);
    for (let i = 0; i < batchCount; i++) {
      db.labBatches.push({
        id: newId('batch'),
        classId,
        name: `Batch ${String.fromCharCode(65 + i)}`,
        // Dealt round-robin so each batch is a mix of roll numbers rather than
        // the first half and the second half of the register.
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
      if (batch.classId !== target.classId) continue;
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
    if (inCharge && !inCharge.roles.includes('lab-incharge')) inCharge.roles.push('lab-incharge');
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

/** Record a breakage and the cost to be recovered from the student. */
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

    // Stock falls by what was broken, or the register drifts from the shelf.
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

/** Accession a new title into the library. */
export function addBook(input: {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  category: string;
  copies: number;
  rack: string;
  forGrades: number[];
  price: number;
}) {
  const id = newId('bok');
  mutate((db) => {
    db.books.unshift({
      ...input,
      id,
      schoolId: getActiveBranch(),
      accessionNo: `ACC/${String(db.books.length + 1).padStart(2, '0')}${Math.floor(Math.random() * 900 + 100)}`,
      addedOn: todayISO(),
    });
  });
  return id;
}

/** Extend a loan. Schools cap renewals so a popular title keeps circulating. */
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

/** Close a loan as damaged or lost, and charge for it. */
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

/** A parent asks for transport; the office decides. */
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

/** Approve or refuse a transport request, and bill for it once allotted. */
export function decideTransport(linkId: string, status: 'approved' | 'allotted' | 'rejected') {
  mutate((db) => {
    const link = db.studentTransport.find((t) => t.id === linkId);
    if (!link) return;
    link.status = status;

    const student = db.users.find((u) => u.id === link.studentId);
    const route = db.routes.find((r) => r.id === link.routeId);
    const school = db.schools.find((x) => x.id === getActiveBranch());
    const term = school?.currentTerm ?? 1;

    // Allotment is the point at which the bus fee becomes payable.
    if (status === 'allotted' && route) {
      const already = db.fees.some(
        (f) => f.studentId === link.studentId && f.head.startsWith('Bus Fee'),
      );
      if (!already) {
        const due = new Date();
        due.setDate(due.getDate() + 21);
        db.fees.push({
          id: newId('fee'),
          studentId: link.studentId,
          head: `Bus Fee — Term ${term}`,
          term,
          total: Math.round(route.fee / 3),
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
            : `Boarding point ${link.stop}. The bus fee has been added to your fee account.`,
        kind: 'transport',
        link: '/transport',
      });
    }
  });
}

/** Record renewed vehicle papers. */
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
      schoolId: getActiveBranch(),
      name: input.name,
      vehicleId: input.vehicleId,
      fee: input.fee,
      stops: input.stops,
    });
  });
}

/* ── payroll ───────────────────────────────────────────────────────────── */

/**
 * Generate the month's payslips from each person's salary structure.
 *
 * The statutory figures are indicative: provident fund at 12% of basic capped
 * at the ₹15,000 wage ceiling, ESI at 0.75% below ₹21,000, and professional tax
 * as a flat slab. A payroll a school can file returns from needs its actual
 * scales and challans, and that belongs on a server rather than in a browser.
 */
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

/** Approve and pay a month's payslips. */
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

/** Record days lost to unpaid absence, which changes the month's net. */
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
    if (existing) {
      existing.basic = input.basic;
      existing.da = input.da;
      existing.hra = input.hra;
      existing.conveyance = input.conveyance;
      existing.otherAllowance = input.otherAllowance;
      existing.pf = input.pf;
      existing.esi = input.esi;
      existing.professionalTax = input.professionalTax;
      return;
    }
    db.salaries.push({ ...input, id: newId('sal') });
  });
}

/* ── roles ─────────────────────────────────────────────────────────────── */

/** Change the roles a person holds. This is how permissions are granted. */
export function setUserRoles(userId: string, roles: Role[]) {
  mutate((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user || roles.length === 0) return;
    user.roles = [...new Set(roles)];
  });
}

/**
 * Pay one person, rather than the whole month.
 *
 * Schools need this more often than a bulk run suggests: someone joins
 * mid-month, a payment bounced, or one person's loss of pay is still being
 * worked out while everyone else is ready to be paid.
 */
export function payPayslip(payslipId: string) {
  mutate((db) => {
    const slip = db.payslips.find((p) => p.id === payslipId);
    if (!slip || slip.status === 'paid') return;
    slip.status = 'paid';
    slip.paidOn = todayISO();
    notify(db, {
      userId: slip.staffId,
      title: `Salary credited for ${slip.month}`,
      body: `Net ₹${slip.net.toLocaleString('en-IN')}. Your payslip is available to download.`,
      kind: 'staff',
      link: '/payroll',
    });
  });
}

/** Put a payslip back to draft, for when something has to be corrected. */
export function revertPayslip(payslipId: string) {
  mutate((db) => {
    const slip = db.payslips.find((p) => p.id === payslipId);
    if (!slip) return;
    slip.status = 'draft';
    slip.paidOn = undefined;
  });
}

/** Amend a class once it exists — room, strength, class teacher, group. */
export function updateClass(input: {
  classId: string;
  room: string;
  strength: number;
  classTeacherId: string;
  hscGroupId?: string;
}) {
  mutate((db) => {
    const cls = db.classes.find((c) => c.id === input.classId);
    if (!cls) return;
    const previous = cls.classTeacherId;

    cls.room = input.room;
    cls.strength = input.strength;
    cls.classTeacherId = input.classTeacherId;
    if (cls.stage === 'higher-secondary') cls.hscGroupId = input.hscGroupId;

    if (previous !== input.classTeacherId) {
      const incoming = db.users.find((u) => u.id === input.classTeacherId);
      if (incoming && !incoming.roles.includes('class-teacher')) {
        incoming.roles.push('class-teacher');
      }
      // Someone who no longer holds any class is no longer a class teacher.
      const outgoing = db.users.find((u) => u.id === previous);
      if (outgoing && !db.classes.some((c) => c.classTeacherId === previous)) {
        outgoing.roles = outgoing.roles.filter((r) => r !== 'class-teacher');
      }
      notify(db, {
        userId: input.classTeacherId,
        title: `You are now class teacher of ${cls.label}`,
        body: `${cls.room}. The register and this class's parents are now yours.`,
        kind: 'staff',
        link: '/attendance',
      });
    }
  });
}

/* ── timetable ─────────────────────────────────────────────────────────── */

/**
 * Place a subject in one period of a class's week, or clear it.
 *
 * The teacher follows from who is assigned that subject to that class, so a
 * school sets the teacher once on Academic Setup rather than on thirty-five
 * separate cells. `teacherId` overrides that for a single period, which is what
 * a lab taken by the assistant actually needs.
 */
export function setTimetableSlot(input: {
  slotId: string;
  subjectId: string | null;
  teacherId?: string | null;
}) {
  mutate((db) => {
    const slot = db.timetable.find((s) => s.id === input.slotId);
    if (!slot) return;

    if (!input.subjectId) {
      slot.subjectId = null;
      slot.teacherId = null;
      slot.kind = 'period';
      slot.title = 'Free period';
      slot.labId = undefined;
      slot.batchId = undefined;
      return;
    }

    const offering = db.classSubjects.find(
      (cs) => cs.classId === slot.classId && cs.subjectId === input.subjectId,
    );
    const subject = db.subjects.find((s) => s.id === input.subjectId);

    slot.subjectId = input.subjectId;
    slot.teacherId = input.teacherId ?? offering?.teacherId ?? null;

    // A practical is not an ordinary period: it occupies a lab and takes one
    // batch at a time, so placing one carries that with it.
    if (subject?.hasPractical) {
      const lab = db.labs.find((l) => l.kind === subject.labKind);
      const batch = db.labBatches.find((b) => b.classId === slot.classId);
      slot.kind = 'lab';
      slot.title = `${subject.name} Practical`;
      slot.labId = lab?.id;
      slot.batchId = batch?.id;
    } else {
      slot.kind = 'period';
      slot.title = undefined;
      slot.labId = undefined;
      slot.batchId = undefined;
    }
  });
}

/**
 * Lay out a class's blank week — every period of every teaching day, with
 * breaks and lunch fixed and the lessons empty.
 *
 * A class with no slots at all cannot be scheduled: the period editor fills
 * slots in, it does not invent them, so a newly created class showed a grid
 * with no rows. This is what gives the scheduler something to work on.
 *
 * Returns how many lesson periods are now waiting to be filled.
 */
export function createBlankWeek(classId: string) {
  let created = 0;
  mutate((db) => {
    const cls = db.classes.find((c) => c.id === classId);
    if (!cls) return;

    const already = new Set(
      db.timetable.filter((s) => s.classId === classId).map((s) => `${s.day}-${s.period}`),
    );

    for (const day of TEACHING_DAYS) {
      SCHOOL_PERIODS.forEach((slot, index) => {
        if (!classSitsFor(cls.grade, day, index)) return;
        const period = index + 1;
        if (already.has(`${day}-${period}`)) return;

        db.timetable.push({
          id: newId('slot'),
          classId,
          day,
          period,
          start: slot.start,
          end: slot.end,
          subjectId: null,
          teacherId: null,
          title:
            slot.kind === 'break'
              ? 'Short Break'
              : slot.kind === 'lunch'
                ? 'Lunch Break'
                : 'Free period',
          kind: slot.kind,
        });
        if (slot.kind === 'period') created += 1;
      });
    }
  });
  return created;
}
