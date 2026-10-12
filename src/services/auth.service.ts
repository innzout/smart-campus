import { getDatabase, setActiveBranch } from '@/lib/store';
import type { Role, User } from '@/data/types';

/**
 * Demo authentication and the permission model — entirely in the browser.
 *
 * The prototype runs with no server so a presentation can never be derailed by
 * a backend that didn't start. The permission model is the real one and is what
 * an API would enforce; only the credential check is local.
 *
 * A person holds **several roles** and their permissions are the union. In a
 * college this is not a convenience but the normal case: a Head of Department
 * still teaches, a tutor is a subject teacher for other cohorts, the Accounts
 * Officer also runs payroll, and a warden holds a teaching post as well.
 */

const SESSION_KEY = 'svc.session';
const OVERRIDES_KEY = 'svc.permissions';

export interface AuthUser extends User {
  permissions: string[];
  /** The label shown for this person, taken from their most senior role. */
  roleName: string;
  /** For parents: the student currently being viewed. */
  activeChildId?: string;
}

/* ── permission catalogue ──────────────────────────────────────────────── */

export const PERMISSION_GROUPS: { label: string; items: { key: string; label: string }[] }[] = [
  {
    label: 'General',
    items: [
      { key: 'dashboard.view', label: 'See the dashboard' },
      { key: 'notification.view', label: 'See notifications' },
      { key: 'circular.view', label: 'Read circulars' },
      { key: 'circular.post', label: 'Post circulars' },
      { key: 'circular.delete', label: 'Withdraw circulars' },
      { key: 'event.view', label: 'See events' },
      { key: 'map.view', label: 'See the campus map' },
      { key: 'settings.manage', label: 'Change institution settings' },
    ],
  },
  {
    label: 'Institution',
    items: [
      { key: 'org.view', label: 'See institutions' },
      { key: 'org.manage', label: 'Open institutions and appoint their heads' },
      { key: 'role.view', label: 'See roles and permissions' },
      { key: 'role.manage', label: 'Change what a role may do' },
    ],
  },
  {
    label: 'Academic structure',
    items: [
      { key: 'academic.view', label: 'See programmes, courses and sections' },
      { key: 'academic.manage', label: 'Create programmes, courses and assign faculty' },
      { key: 'timetable.view', label: 'See the timetable' },
      { key: 'timetable.manage', label: 'Build the timetable' },
    ],
  },
  {
    label: 'Attendance',
    items: [
      { key: 'attendance.view.self', label: 'See own attendance' },
      { key: 'attendance.view.child', label: 'See their ward’s attendance' },
      { key: 'attendance.view.class', label: 'See attendance for a section' },
      { key: 'attendance.view.college', label: 'See attendance for the whole college' },
      { key: 'attendance.mark', label: 'Mark the hour register' },
      { key: 'condonation.request', label: 'Apply for condonation of shortage' },
      { key: 'condonation.approve', label: 'Grant or refuse condonation' },
    ],
  },
  {
    label: 'Coursework and results',
    items: [
      { key: 'assignment.view', label: 'See assignments' },
      { key: 'assignment.create', label: 'Set assignments' },
      { key: 'assignment.grade', label: 'Mark assignments' },
      { key: 'result.view.self', label: 'See own results' },
      { key: 'result.view.child', label: 'See their ward’s results' },
      { key: 'result.view.class', label: 'See a section’s results' },
      { key: 'result.enter', label: 'Enter internal marks' },
      { key: 'result.publish', label: 'Publish end-semester results' },
      { key: 'exam.manage', label: 'Run the examination cell' },
    ],
  },
  {
    label: 'Placements',
    items: [
      { key: 'placement.view', label: 'See drives and offers' },
      { key: 'placement.apply', label: 'Register for a drive' },
      { key: 'placement.manage', label: 'Run the placement cell' },
    ],
  },
  {
    label: 'Hostel',
    items: [
      { key: 'hostel.view', label: 'See hostel blocks and allotments' },
      { key: 'hostel.request', label: 'Apply for a hostel place' },
      { key: 'hostel.manage', label: 'Allot rooms and manage residents' },
    ],
  },
  {
    label: 'Mentoring',
    items: [
      { key: 'mentor.view', label: 'See their mentees' },
      { key: 'mentor.note', label: 'Record a mentoring note' },
    ],
  },
  {
    label: 'Staff',
    items: [
      { key: 'staff.view', label: 'See the staff list' },
      { key: 'staff.manage', label: 'Add and edit staff' },
      { key: 'recruitment.view', label: 'See staff applications' },
      { key: 'recruitment.review', label: 'Approve or reject applications' },
      { key: 'leave.request', label: 'Apply for leave' },
      { key: 'leave.approve', label: 'Approve staff leave' },
      { key: 'substitution.view', label: 'See the day’s adjustments' },
      { key: 'substitution.manage', label: 'Arrange cover for absent faculty' },
      { key: 'payroll.view', label: 'See payslips' },
      { key: 'payroll.manage', label: 'Run payroll' },
    ],
  },
  {
    label: 'Students and money',
    items: [
      { key: 'student.view', label: 'See the student directory' },
      { key: 'student.manage', label: 'Admit and edit students' },
      { key: 'fee.view.child', label: 'See their ward’s fees' },
      { key: 'fee.view.college', label: 'See fees for the whole college' },
      { key: 'fee.pay', label: 'Pay fees online' },
      { key: 'fee.collect', label: 'Collect fees at the counter' },
      { key: 'report.view', label: 'See management reports' },
    ],
  },
  {
    label: 'Laboratories',
    items: [
      { key: 'lab.view', label: 'See laboratories and batches' },
      { key: 'lab.manage', label: 'Manage labs, batches and apparatus' },
      { key: 'lab.breakage.record', label: 'Record breakages' },
    ],
  },
  {
    label: 'Library',
    items: [
      { key: 'library.view', label: 'Search the library' },
      { key: 'library.borrow', label: 'Borrow a book' },
      { key: 'library.manage', label: 'Accession, issue and return books' },
    ],
  },
  {
    label: 'Transport',
    items: [
      { key: 'transport.view', label: 'See bus routes' },
      { key: 'transport.request', label: 'Request transport' },
      { key: 'transport.manage', label: 'Allot students and manage routes' },
      { key: 'transport.compliance', label: 'See vehicle papers and expiry' },
    ],
  },
  {
    label: 'Front desk',
    items: [
      { key: 'request.raise', label: 'Raise a help-desk request' },
      { key: 'request.view.self', label: 'See own requests' },
      { key: 'request.view.all', label: 'See all requests' },
      { key: 'request.resolve', label: 'Act on requests' },
      { key: 'meeting.view', label: 'See PTM slots' },
      { key: 'meeting.book', label: 'Book a PTM slot' },
      { key: 'meeting.manage', label: 'Open and manage PTM slots' },
      { key: 'visit.view', label: 'See campus visits' },
      { key: 'visit.request', label: 'Request a visit' },
      { key: 'visit.approve', label: 'Approve visits and check visitors in' },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const COMMON = ['dashboard.view', 'notification.view', 'circular.view', 'event.view', 'map.view'];

const PARENT = [
  ...COMMON, 'timetable.view', 'attendance.view.child', 'assignment.view',
  'result.view.child', 'fee.view.child', 'fee.pay', 'transport.view',
  'transport.request', 'request.raise', 'request.view.self', 'meeting.view',
  'meeting.book', 'visit.view', 'visit.request', 'library.view',
  'placement.view', 'hostel.view', 'hostel.request', 'condonation.request',
];

const STUDENT = [
  ...COMMON, 'timetable.view', 'attendance.view.self', 'assignment.view',
  'result.view.self', 'library.view', 'library.borrow', 'transport.view',
  'transport.request', 'request.raise', 'request.view.self', 'meeting.view',
  'visit.view', 'lab.view', 'placement.view', 'placement.apply',
  'hostel.view', 'hostel.request', 'condonation.request',
];

/** What any member of teaching staff may do. */
const FACULTY = [
  ...COMMON, 'timetable.view', 'attendance.view.class', 'attendance.mark',
  'assignment.view', 'assignment.create', 'assignment.grade',
  'result.view.class', 'result.enter', 'student.view', 'staff.view',
  'leave.request', 'substitution.view', 'library.view', 'transport.view',
  'meeting.view', 'visit.view', 'payroll.view', 'lab.view', 'academic.view',
  'request.view.all', 'placement.view', 'mentor.view', 'mentor.note',
];

/** A tutor owns a cohort: its register, its parents and its mentoring. */
const TUTOR = [
  ...FACULTY, 'circular.post', 'meeting.manage', 'request.resolve',
  'visit.approve', 'condonation.request', 'attendance.view.college',
];

const HEAD = [
  ...TUTOR, 'result.publish', 'academic.manage', 'timetable.manage',
  'staff.manage', 'recruitment.view', 'recruitment.review', 'leave.approve',
  'substitution.manage', 'student.manage', 'report.view', 'circular.delete',
  'lab.manage', 'org.view', 'role.view', 'condonation.approve',
];

export const ROLE_CATALOGUE: Record<Role, { name: string; blurb: string; permissions: string[] }> = {
  'group-admin': {
    name: 'Group Administrator',
    blurb: 'The trust’s own account. Opens institutions and appoints their heads.',
    permissions: [...HEAD, 'org.manage', 'role.manage', 'settings.manage', 'fee.view.college', 'payroll.view', 'transport.compliance', 'placement.manage', 'hostel.view'],
  },
  chairman: {
    name: 'Chairman',
    blurb: 'Head of the trust that runs the college.',
    permissions: [...HEAD, 'role.manage', 'settings.manage', 'fee.view.college', 'fee.collect', 'payroll.view', 'payroll.manage', 'library.manage', 'transport.manage', 'transport.compliance', 'placement.manage', 'hostel.view'],
  },
  principal: {
    name: 'Principal',
    blurb: 'Runs the college and signs off on appointments and condonation.',
    permissions: [...HEAD, 'fee.view.college', 'settings.manage', 'placement.view', 'hostel.view', 'exam.manage'],
  },
  'vice-principal': {
    name: 'Vice Principal',
    blurb: 'Academic coordination — timetable, cover and discipline.',
    permissions: [...TUTOR, 'substitution.manage', 'leave.approve', 'academic.manage', 'timetable.manage', 'result.publish', 'report.view', 'condonation.approve'],
  },
  dean: {
    name: 'Dean',
    blurb: 'Oversees a faculty and its departments.',
    permissions: [...HEAD],
  },
  hod: {
    name: 'Head of Department',
    blurb: 'Runs a department: its faculty, its syllabus and its results.',
    permissions: [...TUTOR, 'academic.manage', 'timetable.manage', 'leave.approve', 'substitution.manage', 'recruitment.view', 'report.view', 'lab.manage', 'condonation.request'],
  },
  faculty: {
    name: 'Faculty',
    blurb: 'Teaches papers across sections.',
    permissions: FACULTY,
  },
  tutor: {
    name: 'Tutor',
    blurb: 'Class advisor for one cohort — its register, parents and mentoring.',
    permissions: TUTOR,
  },
  'controller-of-exams': {
    name: 'Controller of Examinations',
    blurb: 'Hall tickets, results, arrears and condonation.',
    permissions: [
      ...COMMON, 'exam.manage', 'result.publish', 'result.view.class', 'result.enter',
      'condonation.approve', 'attendance.view.college', 'student.view', 'academic.view',
      'report.view', 'circular.post', 'staff.view', 'leave.request', 'payroll.view',
      'timetable.view',
    ],
  },
  'office-superintendent': {
    name: 'Office Superintendent',
    blurb: 'Admissions, records, certificates and the front desk.',
    permissions: [
      ...COMMON, 'student.view', 'student.manage', 'staff.view', 'academic.view',
      'attendance.view.college', 'request.view.all', 'request.resolve', 'visit.view',
      'visit.approve', 'meeting.view', 'meeting.manage', 'transport.view',
      'transport.manage', 'circular.post', 'report.view', 'recruitment.view',
      'leave.request', 'payroll.view', 'hostel.view', 'timetable.view',
    ],
  },
  'accounts-officer': {
    name: 'Accounts Officer',
    blurb: 'Fee collection, receipts and the defaulter list.',
    permissions: [
      ...COMMON, 'fee.view.college', 'fee.collect', 'student.view', 'report.view',
      'transport.view', 'visit.view', 'visit.approve', 'meeting.view', 'leave.request',
      'payroll.view', 'hostel.view',
    ],
  },
  'payroll-officer': {
    name: 'Payroll Officer',
    blurb: 'Salary, PF and ESI. Usually the same person as Accounts.',
    permissions: [...COMMON, 'payroll.view', 'payroll.manage', 'staff.view', 'report.view', 'leave.request'],
  },
  librarian: {
    name: 'Librarian',
    blurb: 'Accession, issue, return and fines.',
    permissions: [
      ...COMMON, 'library.view', 'library.manage', 'library.borrow', 'student.view',
      'staff.view', 'leave.request', 'payroll.view', 'visit.view',
    ],
  },
  'lab-instructor': {
    name: 'Lab Instructor',
    blurb: 'Sets up practicals and keeps the apparatus register.',
    permissions: [
      ...COMMON, 'lab.view', 'lab.manage', 'lab.breakage.record', 'student.view',
      'timetable.view', 'leave.request', 'payroll.view', 'attendance.view.class',
    ],
  },
  'placement-officer': {
    name: 'Placement Officer',
    blurb: 'Recruiters, drives, eligibility and offers.',
    permissions: [
      ...COMMON, 'placement.view', 'placement.manage', 'student.view', 'report.view',
      'circular.post', 'academic.view', 'result.view.class', 'leave.request',
      'payroll.view', 'staff.view',
    ],
  },
  'transport-incharge': {
    name: 'Transport In-charge',
    blurb: 'Routes, buses, drivers and vehicle papers.',
    permissions: [
      ...COMMON, 'transport.view', 'transport.manage', 'transport.compliance',
      'student.view', 'circular.post', 'leave.request', 'payroll.view',
      'request.view.all', 'request.resolve',
    ],
  },
  'hostel-warden': {
    name: 'Hostel Warden',
    blurb: 'Blocks, rooms, allotment and residents.',
    permissions: [
      ...COMMON, 'hostel.view', 'hostel.manage', 'student.view', 'attendance.view.college',
      'leave.request', 'payroll.view', 'visit.view', 'request.view.all', 'request.resolve',
    ],
  },
  parent: { name: 'Parent', blurb: 'Sees only their own ward.', permissions: PARENT },
  student: { name: 'Student', blurb: 'Sees only their own record.', permissions: STUDENT },
};

/** Roles ordered by seniority, used to pick the label shown for a person. */
const SENIORITY: Role[] = [
  'group-admin', 'chairman', 'principal', 'vice-principal', 'dean',
  'controller-of-exams', 'hod', 'office-superintendent', 'accounts-officer',
  'payroll-officer', 'placement-officer', 'hostel-warden', 'transport-incharge',
  'librarian', 'tutor', 'faculty', 'lab-instructor', 'parent', 'student',
];

/* ── editable permission sets ──────────────────────────────────────────── */

type Overrides = Partial<Record<Role, string[]>>;

function readOverrides(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}') as Overrides;
  } catch {
    return {};
  }
}

/** The permissions a role currently carries, after any local edit. */
export function permissionsForRole(role: Role): string[] {
  const override = readOverrides()[role];
  return [...new Set(override ?? ROLE_CATALOGUE[role]?.permissions ?? [])];
}

/** Change what a role may do. Pass `null` to go back to the default. */
export function setRolePermissions(role: Role, permissions: string[] | null) {
  const overrides = readOverrides();
  if (permissions === null) delete overrides[role];
  else overrides[role] = [...new Set(permissions)];
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    /* private mode — the change lasts for this session only */
  }
}

export const isRoleEdited = (role: Role) => readOverrides()[role] !== undefined;

export const roleName = (role: Role) => ROLE_CATALOGUE[role]?.name ?? role;

/** Everything a person may do, being the union across every role they hold. */
export function permissionsFor(roles: readonly Role[]): string[] {
  return [...new Set(roles.flatMap((r) => permissionsForRole(r)))];
}

/** The most senior role a person holds, which is the one worth labelling them by. */
export function primaryRole(roles: readonly Role[]): Role {
  return SENIORITY.find((r) => roles.includes(r)) ?? roles[0] ?? 'student';
}

function present(user: User): AuthUser {
  return {
    ...user,
    permissions: permissionsFor(user.roles),
    roleName: roleName(primaryRole(user.roles)),
    activeChildId: user.childIds?.[0],
  };
}

/* ── session ───────────────────────────────────────────────────────────── */

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode — the session simply won't survive a reload */
  }
}

export const authService = {
  login(
    email: string,
    password: string,
  ): { ok: true; user: AuthUser } | { ok: false; error: string } {
    const db = getDatabase();
    const identifier = email.trim().toLowerCase();

    // A college hands out a register number, not an email address, and that is
    // what a parent has written down — so it signs in the guardian.
    let found = db.users.find((u) => u.email.toLowerCase() === identifier);
    if (!found) {
      const student = db.users.find(
        (u) => u.roles.includes('student') && u.registerNo?.toLowerCase() === identifier,
      );
      if (student) {
        found = db.users.find((u) => u.id === student.guardianIds?.[0]) ?? student;
      }
    }
    if (!found) return { ok: false, error: 'No account found for that email or register number.' };
    if (found.password !== password) return { ok: false, error: 'That password is incorrect.' };
    if (found.status !== 'active') {
      return { ok: false, error: 'This account is inactive. Please contact the college office.' };
    }
    writeSession(found.id);
    setActiveBranch(found.collegeId);
    return { ok: true, user: present(found) };
  },

  restore(): AuthUser | null {
    const id = readSession();
    if (!id) return null;
    const found = getDatabase().users.find((u) => u.id === id);
    if (!found || found.status !== 'active') return null;

    const user = present(found);
    // The chosen institution outlives a reload for the trust's account. For
    // anyone else it must not: on a shared office machine they would otherwise
    // come back to whichever institution was last looked at.
    if (!user.permissions.includes('org.view')) setActiveBranch(found.collegeId);
    return user;
  },

  logout() {
    writeSession(null);
  },

  /** Re-read from the store, e.g. after a profile edit. */
  refresh(id: string): AuthUser | null {
    const found = getDatabase().users.find((u) => u.id === id);
    return found ? present(found) : null;
  },
};
