/**
 * Domain model for the school ERP.
 *
 * Shaped around a Tamil Nadu private school run by a trust, which is the
 * structure most Indian private schools share: a trust owns one or more
 * branches, each branch has a Correspondent as its legal head, and teaching
 * staff carry a graded designation (SGT / BT Assistant / PG Assistant).
 */

/* ── organisation ──────────────────────────────────────────────────────── */

/** The trust or society that owns the schools. One per deployment. */
export interface Group {
  id: string;
  name: string;
  trustName: string;
  registrationNo: string;
  chairman: string;
  address: string;
  phone: string;
  email: string;
}

export interface School {
  id: string;
  groupId: string;
  name: string;
  shortName: string;
  /** DSE recognition code. */
  code: string;
  board: string;
  /** School motto, in Tamil. */
  tagline: string;
  /** The same motto in English, shown alongside. */
  taglineEn: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  academicYear: string;
  currentTerm: 1 | 2 | 3;
  /** The branch the trust treats as its main campus. */
  isMain: boolean;
  /** Date the JSON was generated; the app rebases forward from it. */
  seededOn: string;
}

/* ── academic structure ────────────────────────────────────────────────── */

/**
 * Tamil Nadu school stages. Subjects, teacher grades and assessment all differ
 * by stage, which is why a single flat "class" model does not survive contact
 * with a real school.
 */
export type Stage = 'pre-primary' | 'primary' | 'middle' | 'secondary' | 'higher-secondary';

export const STAGE_LABEL: Record<Stage, string> = {
  'pre-primary': 'Pre-Primary',
  primary: 'Primary',
  middle: 'Middle',
  secondary: 'Secondary',
  'higher-secondary': 'Higher Secondary',
};

/**
 * Higher Secondary groups. A class 11 or 12 student takes a language, English
 * and four subjects fixed by the group they choose.
 */
export interface HscGroup {
  id: string;
  /** G1 … G5 */
  code: string;
  name: string;
  description: string;
  /** Subject template ids, beyond the two compulsory languages. */
  subjectIds: string[];
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  /** 0 = LKG, -1 = UKG are avoided; pre-primary uses `name` instead. */
  grade: number;
  section: string;
  /** "8-A", "11-A" */
  label: string;
  stage: Stage;
  /** Only for classes 11 and 12. */
  hscGroupId?: string;
  classTeacherId: string;
  room: string;
  strength: number;
}

export type SubjectKind = 'language' | 'core' | 'elective' | 'co-curricular';

/**
 * A subject as the school offers it, independent of any class. Which classes
 * it applies to is expressed by `grades` — that is what lets Classes 1–5 carry
 * four subjects while 11-A Group 1 carries six.
 */
export interface SubjectTemplate {
  id: string;
  code: string;
  name: string;
  nameTa?: string;
  kind: SubjectKind;
  /** The grades this subject is offered to. */
  grades: number[];
  maxMarks: number;
  /** Higher Secondary science subjects carry a practical component. */
  hasPractical: boolean;
  practicalMarks: number;
  /** Which lab the practical runs in, if any. */
  labKind?: LabKind;
}

/** A subject actually offered to one class-section, with its teacher. */
export interface ClassSubject {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  periodsPerWeek: number;
}

/* ── people ────────────────────────────────────────────────────────────── */

/**
 * Role is what a person may *do*. It is separate from designation, and a
 * person holds several — an Accounts Officer in a small school is usually the
 * Payroll Officer too.
 */
export type Role =
  | 'group-admin'
  | 'correspondent'
  | 'principal'
  | 'headmaster'
  | 'vice-principal'
  | 'office-superintendent'
  | 'accounts-officer'
  | 'payroll-officer'
  | 'class-teacher'
  | 'subject-teacher'
  | 'librarian'
  | 'lab-incharge'
  | 'lab-assistant'
  | 'transport-incharge'
  | 'warden'
  | 'parent'
  | 'student';

/**
 * Designation is what a person is *employed as*. The teaching ladder is the
 * Tamil Nadu one, and the grade determines which classes they may teach.
 */
export type Designation =
  | 'correspondent'
  | 'principal'
  | 'headmaster'
  | 'vice-principal'
  | 'pg-assistant'
  | 'bt-assistant'
  | 'sgt'
  | 'pet'
  | 'librarian'
  | 'lab-assistant'
  | 'office-superintendent'
  | 'accounts-officer'
  | 'attender';

export const DESIGNATION_LABEL: Record<Designation, string> = {
  correspondent: 'Correspondent',
  principal: 'Principal',
  headmaster: 'Headmaster / Headmistress',
  'vice-principal': 'Vice Principal',
  'pg-assistant': 'P.G. Assistant',
  'bt-assistant': 'B.T. Assistant',
  sgt: 'Secondary Grade Teacher',
  pet: 'Physical Education Teacher',
  librarian: 'Librarian',
  'lab-assistant': 'Lab Assistant',
  'office-superintendent': 'Office Superintendent',
  'accounts-officer': 'Accounts Officer',
  attender: 'Attender',
};

/** The grades a teaching designation is qualified to handle. */
export const DESIGNATION_GRADES: Partial<Record<Designation, number[]>> = {
  sgt: [1, 2, 3, 4, 5],
  'bt-assistant': [6, 7, 8, 9, 10],
  'pg-assistant': [11, 12],
  pet: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

export interface User {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  password: string;
  /** A person may hold several roles. */
  roles: Role[];
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
  guardianIds?: string[];

  /* parents */
  childIds?: string[];
  occupation?: string;

  /* staff */
  employeeId?: string;
  designation?: Designation;
  qualification?: string;
  /** Teacher Eligibility Test — required for several posts in Tamil Nadu. */
  tetCleared?: boolean;
  dateOfJoining?: string;
  /** Subject templates this member of staff is qualified to teach. */
  subjectIds?: string[];
}

/* ── staff recruitment ─────────────────────────────────────────────────── */

export type DocumentKind =
  | 'degree'
  | 'bed'
  | 'tet'
  | 'aadhaar'
  | 'pan'
  | 'bank'
  | 'experience';

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  degree: 'Degree certificate',
  bed: 'B.Ed certificate',
  tet: 'TET certificate',
  aadhaar: 'Aadhaar card',
  pan: 'PAN card',
  bank: 'Bank passbook',
  experience: 'Experience certificate',
};

export interface StaffDocument {
  kind: DocumentKind;
  fileName: string;
  uploadedOn: string;
  verified: boolean;
}

export type ApplicationStatus = 'draft' | 'submitted' | 'under-review' | 'approved' | 'rejected';

/** A teaching or non-teaching applicant, pending the Principal's approval. */
export interface StaffApplication {
  id: string;
  ref: string;
  schoolId: string;
  name: string;
  email: string;
  phone: string;
  designation: Designation;
  qualification: string;
  tetCleared: boolean;
  experienceYears: number;
  /** Subject template ids the applicant can teach. */
  subjectIds: string[];
  documents: StaffDocument[];
  status: ApplicationStatus;
  submittedOn: string;
  reviewedById?: string;
  reviewedOn?: string;
  reviewNote: string;
}

/* ── leave and substitution ────────────────────────────────────────────── */

export type LeaveKind = 'casual' | 'medical' | 'earned' | 'on-duty' | 'maternity';

export interface StaffLeave {
  id: string;
  staffId: string;
  kind: LeaveKind;
  from: string;
  to: string;
  reason: string;
  status: 'requested' | 'approved' | 'rejected';
  approvedById?: string;
}

/**
 * Cover for a period whose teacher is absent. Schools call this the daily
 * "adjustment", and it is the academic coordinator's first job each morning.
 */
export interface Substitution {
  id: string;
  date: string;
  slotId: string;
  classId: string;
  absentTeacherId: string;
  coverTeacherId: string;
  assignedById: string;
  note: string;
}

/* ── timetable ─────────────────────────────────────────────────────────── */

export interface ClassSlot {
  id: string;
  classId: string;
  /** 1 = Monday … 6 = Saturday */
  day: number;
  period: number;
  start: string;
  end: string;
  subjectId: string | null;
  teacherId: string | null;
  title?: string;
  kind: 'period' | 'break' | 'lunch' | 'activity' | 'lab';
  /** Set when this period is a practical. */
  labId?: string;
  batchId?: string;
}

/* ── laboratories ──────────────────────────────────────────────────────── */

export type LabKind = 'physics' | 'chemistry' | 'botany' | 'zoology' | 'computer';

export const LAB_LABEL: Record<LabKind, string> = {
  physics: 'Physics Laboratory',
  chemistry: 'Chemistry Laboratory',
  botany: 'Botany Laboratory',
  zoology: 'Zoology Laboratory',
  computer: 'Computer Laboratory',
};

export interface Lab {
  id: string;
  schoolId: string;
  name: string;
  kind: LabKind;
  room: string;
  /** How many students can work at once — this is why classes split into batches. */
  capacity: number;
  inChargeId: string;
  assistantId: string;
}

/** A class too large for the lab is split into batches that attend separately. */
export interface LabBatch {
  id: string;
  classId: string;
  name: string;
  studentIds: string[];
}

export interface LabItem {
  id: string;
  labId: string;
  name: string;
  quantity: number;
  unit: string;
  condition: 'good' | 'needs-repair' | 'condemned';
}

export interface LabBreakage {
  id: string;
  labId: string;
  itemId: string;
  studentId: string;
  date: string;
  quantity: number;
  note: string;
  /** Schools recover breakage cost from the student. */
  amount: number;
  recovered: boolean;
}

/* ── attendance, coursework, assessment ───────────────────────────────── */

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'holiday';

export interface AttendanceDay {
  id: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  reason?: string;
  markedBy?: string;
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
  done: boolean;
  submittedOn: string | null;
  remark: string;
}

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
  /** Higher Secondary science subjects are marked out of theory + practical. */
  practicalMarks: number | null;
}

/* ── money ─────────────────────────────────────────────────────────────── */

export interface FeeItem {
  id: string;
  studentId: string;
  head: string;
  term: 1 | 2 | 3 | 0;
  total: number;
  paid: number;
  dueOn: string;
  /** Concession granted by the school, already deducted from `total`. */
  concession: number;
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
  collectedById?: string;
}

/* ── payroll ───────────────────────────────────────────────────────────── */

export interface SalaryStructure {
  id: string;
  staffId: string;
  basic: number;
  da: number;
  hra: number;
  conveyance: number;
  otherAllowance: number;
  /** Employee contributions, deducted from gross. */
  pf: number;
  esi: number;
  professionalTax: number;
}

export interface Payslip {
  id: string;
  staffId: string;
  /** "YYYY-MM" */
  month: string;
  gross: number;
  deductions: number;
  net: number;
  lopDays: number;
  status: 'draft' | 'approved' | 'paid';
  paidOn?: string;
}

/* ── communication ─────────────────────────────────────────────────────── */

export interface Circular {
  id: string;
  schoolId: string;
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
  schoolId: string;
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

export interface Visit {
  id: string;
  passNo: string;
  parentId: string;
  studentId: string;
  visitorName: string;
  purpose:
    | 'Parent-Teacher Meeting'
    | 'Meet a teacher'
    | 'Fee payment'
    | 'Collect child'
    | 'Document collection'
    | 'Other';
  date: string;
  time: string;
  meetingWith: string;
  status: 'requested' | 'approved' | 'checked-in' | 'completed' | 'rejected';
  inTime?: string;
  outTime?: string;
  note: string;
}

/* ── transport ─────────────────────────────────────────────────────────── */

export interface BusStop {
  name: string;
  time: string;
}

/** Vehicle papers a school must keep current — the compliance side of transport. */
export interface Vehicle {
  id: string;
  schoolId: string;
  busNo: string;
  model: string;
  capacity: number;
  driverName: string;
  driverPhone: string;
  driverLicenceNo: string;
  attendantName: string;
  attendantPhone: string;
  /** Fitness certificate, insurance and permit expiry. */
  fcExpiry: string;
  insuranceExpiry: string;
  permitExpiry: string;
}

export interface TransportRoute {
  id: string;
  schoolId: string;
  name: string;
  vehicleId: string;
  stops: BusStop[];
  /** Annual fee for this route. */
  fee: number;
}

export interface StudentTransport {
  id: string;
  studentId: string;
  routeId: string;
  stop: string;
  /** Parents may request transport; the office allots it. */
  status: 'requested' | 'approved' | 'allotted' | 'rejected';
  requestedOn: string;
}

/* ── library ───────────────────────────────────────────────────────────── */

export interface Book {
  id: string;
  schoolId: string;
  accessionNo: string;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  category: string;
  copies: number;
  rack: string;
  forGrades: number[];
  price: number;
  addedOn: string;
}

export interface Loan {
  id: string;
  bookId: string;
  studentId: string;
  borrowedOn: string;
  dueOn: string;
  returnedOn: string | null;
  fine: number;
  renewals: number;
  condition: 'good' | 'damaged' | 'lost';
}

/* ── misc ──────────────────────────────────────────────────────────────── */

export interface Notification {
  id: string;
  userId: string | 'all';
  /** Set on a notice to everyone, so it stays inside its own branch. */
  schoolId?: string;
  title: string;
  body: string;
  kind:
    | 'attendance'
    | 'fee'
    | 'homework'
    | 'event'
    | 'result'
    | 'transport'
    | 'staff'
    | 'system';
  createdOn: string;
  read: boolean;
  link?: string;
}

export interface SchoolPlace {
  id: string;
  schoolId: string;
  name: string;
  kind: 'academic' | 'amenity' | 'sports' | 'admin' | 'lab';
  x: number;
  y: number;
  w: number;
  h: number;
  open: string;
  detail: string;
}

/* ── the database ──────────────────────────────────────────────────────── */

export interface Database {
  group: Group[];
  schools: School[];
  hscGroups: HscGroup[];
  classes: SchoolClass[];
  subjects: SubjectTemplate[];
  classSubjects: ClassSubject[];
  users: User[];
  applications: StaffApplication[];
  leaves: StaffLeave[];
  substitutions: Substitution[];
  timetable: ClassSlot[];
  labs: Lab[];
  labBatches: LabBatch[];
  labItems: LabItem[];
  labBreakages: LabBreakage[];
  attendance: AttendanceDay[];
  homework: Homework[];
  homeworkStatus: HomeworkStatus[];
  exams: Exam[];
  marks: Mark[];
  fees: FeeItem[];
  payments: Payment[];
  salaries: SalaryStructure[];
  payslips: Payslip[];
  circulars: Circular[];
  events: SchoolEvent[];
  requests: HelpRequest[];
  meetingSlots: MeetingSlot[];
  meetingBookings: MeetingBooking[];
  visits: Visit[];
  vehicles: Vehicle[];
  routes: TransportRoute[];
  studentTransport: StudentTransport[];
  books: Book[];
  loans: Loan[];
  notifications: Notification[];
  places: SchoolPlace[];
}

export type CollectionName = keyof Database;
