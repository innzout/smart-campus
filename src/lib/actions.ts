import { mutate, newId } from './store';
import { todayISO } from './utils';
import type {
  AttendanceStatus,
  Circular,
  HelpRequest,
  Notification,
  Role,
} from '@/data/types';

const nowStamp = () => new Date().toISOString().slice(0, 19);

function notify(
  draft: { notifications: Notification[] },
  n: Omit<Notification, 'id' | 'createdOn' | 'read'>,
) {
  draft.notifications.unshift({ ...n, id: newId('ntf'), createdOn: nowStamp(), read: false });
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

    const students = db.users.filter((u) => u.role === 'student' && u.classId === input.classId);
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
          maxMarks: 100,
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
      if (u.role !== 'student') return false;
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
      db.studentTransport.push({ id: newId('stt'), studentId, routeId, stop });
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
      role: 'student',
      admissionNo: `SVM${year}${1000 + db.users.filter((u) => u.role === 'student').length}`,
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
      role: 'parent',
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
