/** Domain model for the school JSON database. */

/** Seeded role keys. Roles are data, so this is the default set, not a limit. */
export type Role =
  | 'student'
  | 'parent'
  | 'teacher'
  | 'principal'
  | 'accountant'
  | 'librarian'
  | 'transport'
  | 'admin';

export interface School {
  id: string;
  name: string;
  shortName: string;
  /** School motto, in Tamil. */
  tagline: string;
  /** The same motto in English, shown alongside. */
  taglineEn: string;
  board: string;
  address: string;
  phone: string;
  email: string;
  academicYear: string;
  /** The term the app treats as "now". */
  currentTerm: 1 | 2 | 3;
  /** Date the JSON was generated; the app rebases forward from it. */
  seededOn: string;
}

/** A class-section, e.g. 8-A. The unit a school actually organises around. */
export interface SchoolClass {
  id: string;
  /** 1..12 */
  grade: number;
  section: string;
  /** "8-A" */
  label: string;
  classTeacherId: string;
  room: string;
  strength: number;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  /** Tamil name, shown alongside for parents. */
  nameTa?: string;
  grade: number;
  teacherId: string;
  maxMarks: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  phone: string;
  status: 'active' | 'inactive';
  joinedOn: string;
  avatarHue: number;

  /* students */
  admissionNo?: string;
  rollNo?: number;
  classId?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  /** Parent user ids. */
  guardianIds?: string[];

  /* parents */
  childIds?: string[];
  occupation?: string;

  /* staff */
  employeeId?: string;
  designation?: string;
  subjectIds?: string[];
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'holiday';

/** Schools mark attendance once a day, not per period. */
export interface AttendanceDay {
  id: string;
  studentId: string;
  /** YYYY-MM-DD */
  date: string;
  status: AttendanceStatus;
  reason?: string;
  markedBy?: string;
}

export interface ClassSlot {
  id: string;
  classId: string;
  /** 1 = Monday … 6 = Saturday */
  day: number;
  period: number;
  start: string;
  end: string;
  subjectId: string | null;
  title?: string;
  kind: 'period' | 'break' | 'lunch' | 'activity';
}

export interface Homework {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  description: string;
  assignedOn: string;
  dueOn: string;
  assignedById: string;
}

export interface HomeworkStatus {
  id: string;
  homeworkId: string;
  studentId: string;
  /** Schools track done / not done, with an optional teacher remark. */
  done: boolean;
  submittedOn: string | null;
  remark: string;
}

/** Quarterly / Half-Yearly / Annual, the Tamil Nadu matriculation pattern. */
export interface Exam {
  id: string;
  name: string;
  shortName: string;
  term: 1 | 2 | 3;
  grade: number;
  startsOn: string;
  endsOn: string;
  published: boolean;
}

export interface Mark {
  id: string;
  studentId: string;
  examId: string;
  subjectId: string;
  marks: number | null;
  maxMarks: number;
}

export interface FeeItem {
  id: string;
  studentId: string;
  head: string;
  term: 1 | 2 | 3 | 0;
  total: number;
  paid: number;
  dueOn: string;
}

export interface Payment {
  id: string;
  studentId: string;
  feeId: string;
  amount: number;
  method: 'upi' | 'card' | 'netbanking' | 'cash' | 'cheque';
  paidOn: string;
  reference: string;
  receiptNo: string;
}

export interface Circular {
  id: string;
  title: string;
  titleTa?: string;
  body: string;
  category: 'Exam' | 'Holiday' | 'Event' | 'Fee' | 'PTM' | 'General' | 'Transport';
  postedOn: string;
  author: string;
  pinned: boolean;
  /** Class ids, or 'all'. */
  audience: string[] | 'all';
  acknowledgedBy: string[];
}

export interface SchoolEvent {
  id: string;
  title: string;
  description: string;
  category: 'Cultural' | 'Sports' | 'Academic' | 'PTM' | 'Holiday';
  date: string;
  time: string;
  venue: string;
  organiser: string;
  forClasses: string[] | 'all';
}

export type RequestStatus = 'open' | 'in-progress' | 'resolved';

/** Help desk: leave requests, transport changes, certificate requests. */
export interface HelpRequest {
  id: string;
  ref: string;
  raisedBy: string;
  aboutStudentId?: string;
  title: string;
  category: 'Leave' | 'Transport' | 'Fee' | 'Certificate' | 'Facility' | 'Other';
  description: string;
  status: RequestStatus;
  createdOn: string;
  updates: { on: string; note: string }[];
}

export interface BusStop {
  name: string;
  time: string;
}

export interface TransportRoute {
  id: string;
  name: string;
  busNo: string;
  driverName: string;
  driverPhone: string;
  stops: BusStop[];
  fee: number;
}

export interface StudentTransport {
  id: string;
  studentId: string;
  routeId: string;
  stop: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  copies: number;
  shelf: string;
  forGrades: number[];
}

export interface Loan {
  id: string;
  bookId: string;
  studentId: string;
  borrowedOn: string;
  dueOn: string;
  returnedOn: string | null;
  fine: number;
}

export interface Notification {
  id: string;
  userId: string | 'all';
  title: string;
  body: string;
  kind: 'attendance' | 'fee' | 'homework' | 'event' | 'result' | 'transport' | 'system';
  createdOn: string;
  read: boolean;
  link?: string;
}

export interface SchoolPlace {
  id: string;
  name: string;
  kind: 'academic' | 'amenity' | 'sports' | 'admin';
  x: number;
  y: number;
  w: number;
  h: number;
  open: string;
  detail: string;
}


/* ── parent engagement ─────────────────────────────────────────────────── */

/** A bookable Parent–Teacher Meeting slot. */
export interface MeetingSlot {
  id: string;
  date: string;
  start: string;
  end: string;
  teacherId: string;
  classId: string;
  capacity: number;
}

export interface MeetingBooking {
  id: string;
  slotId: string;
  parentId: string;
  studentId: string;
  bookedOn: string;
  status: 'booked' | 'completed' | 'cancelled';
  note: string;
  teacherNote: string;
}

/** A parent's visit to the school — requested in the app, passed at the gate. */
export interface Visit {
  id: string;
  passNo: string;
  parentId: string;
  studentId: string;
  visitorName: string;
  purpose: 'Parent-Teacher Meeting' | 'Meet a teacher' | 'Fee payment' | 'Collect child' | 'Document collection' | 'Other';
  date: string;
  time: string;
  meetingWith: string;
  status: 'requested' | 'approved' | 'checked-in' | 'completed' | 'rejected';
  inTime?: string;
  outTime?: string;
  note: string;
}

export interface Database {
  school: School[];
  classes: SchoolClass[];
  subjects: Subject[];
  users: User[];
  attendance: AttendanceDay[];
  timetable: ClassSlot[];
  homework: Homework[];
  homeworkStatus: HomeworkStatus[];
  exams: Exam[];
  marks: Mark[];
  fees: FeeItem[];
  payments: Payment[];
  circulars: Circular[];
  events: SchoolEvent[];
  requests: HelpRequest[];
  routes: TransportRoute[];
  studentTransport: StudentTransport[];
  books: Book[];
  loans: Loan[];
  notifications: Notification[];
  meetingSlots: MeetingSlot[];
  meetingBookings: MeetingBooking[];
  visits: Visit[];
  places: SchoolPlace[];
}

export type CollectionName = keyof Database;
