/**
 * Domain model for the college ERP.
 *
 * Shaped around a Tamil Nadu arts and science college affiliated to a
 * university, which is the structure most Indian private colleges share: a
 * trust owns the college, the college is organised into departments, each
 * department runs programmes, and a programme admits a batch that moves
 * through semesters together.
 *
 * The things that make this a college rather than a school, and that the model
 * has to get right:
 *
 *  - Attendance is per course-hour, not per day. A student can be at 90% in one
 *    course and 60% in another, and the 75% rule is applied per course.
 *  - Assessment is internal (CIA) plus end-semester, carrying credits, and
 *    produces a GPA and a CGPA rather than a percentage.
 *  - A failed course becomes an arrear the student carries and re-sits, which
 *    is the single most consequential fact in an Indian undergraduate's record.
 *  - Students choose electives, so two students in the same section do not
 *    necessarily sit the same papers.
 */

/* ── organisation ──────────────────────────────────────────────────────── */

/** The trust or society that runs the institution. */
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

export interface College {
  id: string;
  groupId: string;
  name: string;
  shortName: string;
  /** AISHE code, which every Indian college has. */
  code: string;
  /** The university this college's degrees are awarded by. */
  affiliatedTo: string;
  /** Autonomous colleges set their own syllabus and conduct their own exams. */
  autonomous: boolean;
  naacGrade: string;
  tagline: string;
  taglineEn: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  /** "2026-27" */
  academicYear: string;
  /** Odd semesters run June–November, even December–April. */
  currentTerm: 'odd' | 'even';
  isMain: boolean;
  /** Date the JSON was generated; the app rebases forward from it. */
  seededOn: string;
}

export interface Department {
  id: string;
  collegeId: string;
  name: string;
  shortName: string;
  /** The Head of Department, who is a member of the teaching staff. */
  hodId: string;
  establishedIn: number;
}

export type ProgrammeLevel = 'ug' | 'pg' | 'research';

export const LEVEL_LABEL: Record<ProgrammeLevel, string> = {
  ug: 'Undergraduate',
  pg: 'Postgraduate',
  research: 'Research',
};

export interface Programme {
  id: string;
  collegeId: string;
  departmentId: string;
  /** "B.Sc. Computer Science" */
  name: string;
  /** "B.Sc. CS" */
  shortName: string;
  level: ProgrammeLevel;
  /** Years; 3 for most UG, 2 for PG. */
  durationYears: number;
  /** 6 for a three-year UG, 4 for a two-year PG. */
  semesters: number;
  /** Credits needed to graduate. */
  totalCredits: number;
  intake: number;
  /** Self-financing programmes charge more and are not government-aided. */
  selfFinancing: boolean;
}

/**
 * A group of students admitted together and moving through the programme as a
 * cohort. A college calls this a class, but it is a batch plus a section.
 */
export interface Section {
  id: string;
  collegeId: string;
  programmeId: string;
  /** Admission year, e.g. 2024 for the 2024–27 batch. */
  batch: number;
  /** "A", "B" */
  section: string;
  /** Which semester this cohort is currently in. */
  semester: number;
  /** "III B.Sc. CS — A" */
  label: string;
  /** The class advisor, called a tutor in most Tamil Nadu colleges. */
  tutorId: string;
  room: string;
  strength: number;
}

/* ── courses ───────────────────────────────────────────────────────────── */

export type CourseKind =
  | 'core'
  | 'allied'
  | 'elective'
  | 'practical'
  | 'project'
  | 'language'
  | 'skill';

export const COURSE_KIND_LABEL: Record<CourseKind, string> = {
  core: 'Core',
  allied: 'Allied',
  elective: 'Elective',
  practical: 'Practical',
  project: 'Project',
  language: 'Language',
  skill: 'Skill / Value-added',
};

/**
 * A paper in the syllabus. Courses belong to a programme and a semester, which
 * is why a college cannot share one flat subject list the way a school can.
 */
export interface Course {
  id: string;
  /** University course code, e.g. 23UCS301. */
  code: string;
  title: string;
  programmeId: string;
  semester: number;
  kind: CourseKind;
  credits: number;
  /** Teaching hours a week. */
  hoursPerWeek: number;
  /** Continuous internal assessment, usually out of 25. */
  ciaMax: number;
  /** End-semester examination, usually out of 75. */
  eseMax: number;
  /** A practical runs in a laboratory. */
  labKind?: LabKind;
}

/** A course actually being taught this semester, by a named member of staff. */
export interface CourseOffering {
  id: string;
  sectionId: string;
  courseId: string;
  facultyId: string;
  /** Electives are taken by some of the cohort, not all of it. */
  isElective: boolean;
  /** For an elective, who chose it. Empty on a core paper, which everyone takes. */
  enrolledIds: string[];
}

/* ── people ────────────────────────────────────────────────────────────── */

/**
 * Role is what a person may *do*, and a person holds several. Designation is
 * what they are *employed as*, and is separate.
 */
export type Role =
  | 'group-admin'
  | 'chairman'
  | 'principal'
  | 'vice-principal'
  | 'dean'
  | 'hod'
  | 'faculty'
  | 'tutor'
  | 'controller-of-exams'
  | 'office-superintendent'
  | 'accounts-officer'
  | 'payroll-officer'
  | 'librarian'
  | 'lab-instructor'
  | 'placement-officer'
  | 'transport-incharge'
  | 'hostel-warden'
  | 'parent'
  | 'student';

export type Designation =
  | 'chairman'
  | 'principal'
  | 'vice-principal'
  | 'dean'
  | 'professor'
  | 'associate-professor'
  | 'assistant-professor'
  | 'physical-director'
  | 'librarian'
  | 'lab-instructor'
  | 'office-superintendent'
  | 'accounts-officer'
  | 'placement-officer'
  | 'office-assistant';

export const DESIGNATION_LABEL: Record<Designation, string> = {
  chairman: 'Chairman',
  principal: 'Principal',
  'vice-principal': 'Vice Principal',
  dean: 'Dean',
  professor: 'Professor',
  'associate-professor': 'Associate Professor',
  'assistant-professor': 'Assistant Professor',
  'physical-director': 'Physical Director',
  librarian: 'Librarian',
  'lab-instructor': 'Lab Instructor',
  'office-superintendent': 'Office Superintendent',
  'accounts-officer': 'Accounts Officer',
  'placement-officer': 'Placement Officer',
  'office-assistant': 'Office Assistant',
};

/** Which designations may teach a postgraduate programme. */
export const PG_TEACHING: Designation[] = ['professor', 'associate-professor', 'assistant-professor'];

export interface User {
  id: string;
  collegeId: string;
  name: string;
  email: string;
  password: string;
  roles: Role[];
  phone: string;
  status: 'active' | 'inactive';
  joinedOn: string;
  avatarHue: number;

  /* students */
  /** University register number, e.g. 23UCS001. */
  registerNo?: string;
  rollNo?: number;
  sectionId?: string;
  programmeId?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  guardianIds?: string[];
  /** The faculty member who mentors this student. */
  mentorId?: string;
  /** Quota the student was admitted under. */
  admissionQuota?: 'management' | 'government' | 'sports' | 'first-graduate';

  /* parents */
  childIds?: string[];
  occupation?: string;

  /* staff */
  employeeId?: string;
  designation?: Designation;
  departmentId?: string;
  qualification?: string;
  /** NET or SET clearance, which matters for UGC pay scales and for teaching PG. */
  netCleared?: boolean;
  /** Years of teaching experience at appointment. */
  experienceYears?: number;
  dateOfJoining?: string;
  /** Course ids this member of staff is competent to teach. */
  courseIds?: string[];
}

/* ── mentoring ─────────────────────────────────────────────────────────── */

/**
 * Most Tamil Nadu colleges assign every student a mentor who follows their
 * attendance and marks across all courses and meets them each month. It is the
 * one piece of pastoral structure a college has that a school does not.
 */
export interface MentorNote {
  id: string;
  mentorId: string;
  studentId: string;
  on: string;
  note: string;
  concern: 'attendance' | 'academic' | 'personal' | 'none';
}

/* ── attendance ────────────────────────────────────────────────────────── */

export type AttendanceStatus = 'present' | 'absent' | 'od' | 'leave';

/**
 * One hour of one course for one student.
 *
 * This is the central difference from a school. A school marks a child present
 * for the day; a college marks attendance against each hour of each paper, and
 * the shortage rule is applied per course, so a student can be debarred from
 * one examination and not another.
 */
export interface AttendanceHour {
  id: string;
  studentId: string;
  offeringId: string;
  date: string;
  /** Which hour of the day, 1-based. */
  hour: number;
  status: AttendanceStatus;
  markedBy?: string;
}

/** The threshold below which a student is short of attendance. */
export const ATTENDANCE_MINIMUM = 75;
/** Between this and the minimum, a student may apply for condonation. */
export const CONDONATION_FLOOR = 65;

export interface Condonation {
  id: string;
  studentId: string;
  offeringId: string;
  semester: number;
  percent: number;
  reason: string;
  status: 'requested' | 'approved' | 'rejected';
  fee: number;
  decidedById?: string;
}

/* ── coursework and assessment ─────────────────────────────────────────── */

export interface Assignment {
  id: string;
  offeringId: string;
  title: string;
  description: string;
  assignedOn: string;
  dueOn: string;
  maxMarks: number;
  assignedById: string;
}

export interface AssignmentStatus {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedOn: string | null;
  marks: number | null;
  remark: string;
}

export type CiaComponent = 'CIA-1' | 'CIA-2' | 'Model' | 'Assignment' | 'Attendance';

/** A single internal assessment component for one student on one paper. */
export interface InternalMark {
  id: string;
  studentId: string;
  offeringId: string;
  component: CiaComponent;
  marks: number | null;
  maxMarks: number;
}

export interface Exam {
  id: string;
  collegeId: string;
  name: string;
  shortName: string;
  /** Which semester's end-semester examination this is. */
  semester: number;
  academicYear: string;
  startsOn: string;
  endsOn: string;
  /** Results are withheld until the Controller of Examinations publishes them. */
  published: boolean;
}

/**
 * A student's outcome in one paper: internal out of 25, external out of 75,
 * a letter grade, grade points and the credits earned.
 */
export interface Result {
  id: string;
  studentId: string;
  examId: string;
  courseId: string;
  semester: number;
  cia: number;
  ese: number | null;
  total: number;
  grade: string;
  gradePoint: number;
  credits: number;
  /** An arrear is carried until it is cleared at a later attempt. */
  status: 'pass' | 'arrear' | 'absent' | 'withheld';
  /** 1 for the first sitting, 2 upward for arrear attempts. */
  attempt: number;
}

/* ── placements ────────────────────────────────────────────────────────── */

/**
 * The placement cell. For a final-year student and for the parent paying the
 * fees, this is the part of a college that justifies the rest of it.
 */
export interface Company {
  id: string;
  collegeId: string;
  name: string;
  sector: string;
  website: string;
  contactName: string;
  contactEmail: string;
}

export interface Drive {
  id: string;
  companyId: string;
  role: string;
  /** Annual package in rupees. */
  packageLpa: number;
  location: string;
  /** Programmes invited to apply. */
  programmeIds: string[];
  minCgpa: number;
  /** Most recruiters will not consider a candidate carrying arrears. */
  maxArrears: number;
  driveOn: string;
  registrationCloses: string;
  rounds: string[];
  status: 'announced' | 'registration-open' | 'in-progress' | 'completed' | 'cancelled';
}

export type DriveStage =
  | 'applied'
  | 'shortlisted'
  | 'aptitude'
  | 'technical'
  | 'hr'
  | 'selected'
  | 'rejected';

export interface DriveApplication {
  id: string;
  driveId: string;
  studentId: string;
  appliedOn: string;
  stage: DriveStage;
  note: string;
}

/* ── hostel ────────────────────────────────────────────────────────────── */

export interface HostelBlock {
  id: string;
  collegeId: string;
  name: string;
  forGender: 'men' | 'women';
  wardenId: string;
  floors: number;
  messCharge: number;
}

export interface HostelRoom {
  id: string;
  blockId: string;
  number: string;
  floor: number;
  /** Two, three or four sharing, which is what the rent follows from. */
  capacity: number;
  rentPerYear: number;
}

export interface HostelAllotment {
  id: string;
  roomId: string;
  studentId: string;
  allottedOn: string;
  status: 'requested' | 'allotted' | 'vacated' | 'rejected';
}

/* ── timetable ─────────────────────────────────────────────────────────── */

export interface ClassHour {
  id: string;
  sectionId: string;
  /** 1 = Monday … 6 = Saturday */
  day: number;
  /** Hour of the college day, 1-based. */
  hour: number;
  start: string;
  end: string;
  offeringId: string | null;
  facultyId: string | null;
  room: string;
  title?: string;
  kind: 'hour' | 'break' | 'lunch' | 'lab' | 'library' | 'mentoring';
  labId?: string;
  batchId?: string;
}

/* ── laboratories ──────────────────────────────────────────────────────── */

export type LabKind = 'computer' | 'physics' | 'chemistry' | 'electronics' | 'language';

export const LAB_LABEL: Record<LabKind, string> = {
  computer: 'Computer Laboratory',
  physics: 'Physics Laboratory',
  chemistry: 'Chemistry Laboratory',
  electronics: 'Electronics Laboratory',
  language: 'Language Laboratory',
};

export interface Lab {
  id: string;
  collegeId: string;
  departmentId: string;
  name: string;
  kind: LabKind;
  room: string;
  capacity: number;
  inChargeId: string;
  assistantId: string;
}

export interface LabBatch {
  id: string;
  sectionId: string;
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
  amount: number;
  recovered: boolean;
}

/* ── money ─────────────────────────────────────────────────────────────── */

export interface FeeItem {
  id: string;
  studentId: string;
  head: string;
  /** Which semester this charge belongs to; 0 for a one-off. */
  semester: number;
  total: number;
  paid: number;
  dueOn: string;
  concession: number;
  /** Scholarships are a large part of how Tamil Nadu students pay. */
  scholarship?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  feeId: string;
  amount: number;
  method: 'upi' | 'card' | 'netbanking' | 'cash' | 'cheque' | 'dd';
  paidOn: string;
  reference: string;
  receiptNo: string;
  collectedById?: string;
}

/* ── staff recruitment, leave and payroll ──────────────────────────────── */

export type DocumentKind =
  | 'degree'
  | 'pg'
  | 'phd'
  | 'net'
  | 'aadhaar'
  | 'pan'
  | 'bank'
  | 'experience'
  | 'publications';

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  degree: 'Degree certificate',
  pg: 'Postgraduate certificate',
  phd: 'Ph.D. certificate',
  net: 'NET / SET certificate',
  aadhaar: 'Aadhaar card',
  pan: 'PAN card',
  bank: 'Bank passbook',
  experience: 'Experience certificate',
  publications: 'List of publications',
};

export interface StaffDocument {
  kind: DocumentKind;
  fileName: string;
  uploadedOn: string;
  verified: boolean;
}

export type ApplicationStatus = 'draft' | 'submitted' | 'under-review' | 'approved' | 'rejected';

export interface StaffApplication {
  id: string;
  ref: string;
  collegeId: string;
  name: string;
  email: string;
  phone: string;
  designation: Designation;
  departmentId: string;
  qualification: string;
  netCleared: boolean;
  phd: boolean;
  experienceYears: number;
  /** Papers published, which is what a college actually screens on. */
  publications: number;
  courseIds: string[];
  documents: StaffDocument[];
  status: ApplicationStatus;
  submittedOn: string;
  reviewedById?: string;
  reviewedOn?: string;
  reviewNote: string;
}

export type LeaveKind = 'casual' | 'medical' | 'earned' | 'on-duty' | 'maternity' | 'academic';

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

export interface Substitution {
  id: string;
  date: string;
  hourId: string;
  sectionId: string;
  absentFacultyId: string;
  coverFacultyId: string;
  assignedById: string;
  note: string;
}

export interface SalaryStructure {
  id: string;
  staffId: string;
  basic: number;
  da: number;
  hra: number;
  conveyance: number;
  otherAllowance: number;
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
  collegeId: string;
  title: string;
  titleTa?: string;
  body: string;
  category: 'Exam' | 'Holiday' | 'Event' | 'Fee' | 'Placement' | 'General' | 'Transport' | 'Hostel';
  postedOn: string;
  author: string;
  pinned: boolean;
  /** Section ids, programme ids, or 'all'. */
  audience: string[] | 'all';
  acknowledgedBy: string[];
}

export interface CollegeEvent {
  id: string;
  collegeId: string;
  title: string;
  description: string;
  category: 'Cultural' | 'Sports' | 'Academic' | 'Placement' | 'Holiday' | 'Seminar';
  date: string;
  time: string;
  venue: string;
  organiser: string;
  forSections: string[] | 'all';
}

export type RequestStatus = 'open' | 'in-progress' | 'resolved';

export interface HelpRequest {
  id: string;
  ref: string;
  raisedBy: string;
  aboutStudentId?: string;
  title: string;
  category: 'Leave' | 'Transport' | 'Fee' | 'Certificate' | 'Hostel' | 'Facility' | 'Exam' | 'Other';
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
  facultyId: string;
  sectionId: string;
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
  facultyNote: string;
}

export interface Visit {
  id: string;
  passNo: string;
  parentId: string;
  studentId: string;
  visitorName: string;
  purpose:
    | 'Parent-Teacher Meeting'
    | 'Meet a faculty member'
    | 'Fee payment'
    | 'Hostel'
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

export interface Vehicle {
  id: string;
  collegeId: string;
  busNo: string;
  model: string;
  capacity: number;
  driverName: string;
  driverPhone: string;
  driverLicenceNo: string;
  attendantName: string;
  attendantPhone: string;
  fcExpiry: string;
  insuranceExpiry: string;
  permitExpiry: string;
}

export interface TransportRoute {
  id: string;
  collegeId: string;
  name: string;
  vehicleId: string;
  stops: BusStop[];
  fee: number;
}

export interface StudentTransport {
  id: string;
  studentId: string;
  routeId: string;
  stop: string;
  status: 'requested' | 'approved' | 'allotted' | 'rejected';
  requestedOn: string;
}

/* ── library ───────────────────────────────────────────────────────────── */

export interface Book {
  id: string;
  collegeId: string;
  accessionNo: string;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  category: string;
  copies: number;
  rack: string;
  /** Programme ids this title is meant for. */
  forProgrammes: string[];
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
  collegeId?: string;
  title: string;
  body: string;
  kind:
    | 'attendance'
    | 'fee'
    | 'assignment'
    | 'event'
    | 'result'
    | 'transport'
    | 'staff'
    | 'placement'
    | 'hostel'
    | 'system';
  createdOn: string;
  read: boolean;
  link?: string;
}

export interface CampusPlace {
  id: string;
  collegeId: string;
  name: string;
  kind: 'academic' | 'amenity' | 'sports' | 'admin' | 'lab' | 'hostel';
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
  colleges: College[];
  departments: Department[];
  programmes: Programme[];
  sections: Section[];
  courses: Course[];
  offerings: CourseOffering[];
  users: User[];
  mentorNotes: MentorNote[];
  applications: StaffApplication[];
  leaves: StaffLeave[];
  substitutions: Substitution[];
  timetable: ClassHour[];
  labs: Lab[];
  labBatches: LabBatch[];
  labItems: LabItem[];
  labBreakages: LabBreakage[];
  attendance: AttendanceHour[];
  condonations: Condonation[];
  assignments: Assignment[];
  assignmentStatus: AssignmentStatus[];
  internalMarks: InternalMark[];
  exams: Exam[];
  results: Result[];
  fees: FeeItem[];
  payments: Payment[];
  salaries: SalaryStructure[];
  payslips: Payslip[];
  companies: Company[];
  drives: Drive[];
  driveApplications: DriveApplication[];
  hostelBlocks: HostelBlock[];
  hostelRooms: HostelRoom[];
  hostelAllotments: HostelAllotment[];
  circulars: Circular[];
  events: CollegeEvent[];
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
  places: CampusPlace[];
}

export type CollectionName = keyof Database;

/* ── grading ───────────────────────────────────────────────────────────── */

/**
 * The ten-point scale most Tamil Nadu autonomous colleges use. A paper is
 * passed at 40 overall, and anything below that is an arrear carried to the
 * next attempt rather than a mark on a report card.
 */
export const GRADE_BANDS: { min: number; grade: string; point: number; remark: string }[] = [
  { min: 91, grade: 'O', point: 10, remark: 'Outstanding' },
  { min: 81, grade: 'D+', point: 9, remark: 'Excellent' },
  { min: 71, grade: 'D', point: 8, remark: 'Distinction' },
  { min: 61, grade: 'A+', point: 7, remark: 'Very good' },
  { min: 51, grade: 'A', point: 6, remark: 'Good' },
  { min: 40, grade: 'B', point: 5, remark: 'Average' },
  { min: 0, grade: 'RA', point: 0, remark: 'Reappear' },
];

export const PASS_MARK = 40;
