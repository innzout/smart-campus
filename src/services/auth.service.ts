import { getDatabase, setActiveBranch } from '@/lib/store';
import type { Role, User } from '@/data/types';

/**
 * Demo authentication and the permission model — entirely in the browser.
 *
 * The prototype runs with no server so a presentation can never be derailed by
 * a backend that didn't start. The permission model is the real one and is what
 * an API would enforce; only the credential check is local.
 *
 * A person holds **several roles**, and their permissions are the union. This
 * is not a convenience: in a school of this size the Accounts Officer is also
 * the Payroll Officer, a Vice Principal still teaches a subject, and a class
 * teacher is a subject teacher elsewhere. One role per account cannot describe
 * that without inventing combined roles that no school would recognise.
 */

const SESSION_KEY = 'svm.session';
const OVERRIDES_KEY = 'svm.permissions';

export interface AuthUser extends User {
  permissions: string[];
  /** The label shown for this person, taken from their most senior role. */
  roleName: string;
  /** For parents: the child currently being viewed. */
  activeChildId?: string;
}

/* ── permission catalogue ──────────────────────────────────────────────── */

/**
 * Every permission the app checks, grouped for the Roles screen. Keeping this
 * list explicit is what lets a permission set be edited without code changes.
 */
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
      { key: 'map.view', label: 'See the school map' },
      { key: 'settings.manage', label: 'Change school settings' },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { key: 'org.view', label: 'See branches' },
      { key: 'org.manage', label: 'Create branches and branch admins' },
      { key: 'role.view', label: 'See roles and permissions' },
      { key: 'role.manage', label: 'Change what a role may do' },
    ],
  },
  {
    label: 'Academic setup',
    items: [
      { key: 'academic.view', label: 'See classes and subjects' },
      { key: 'academic.manage', label: 'Create classes, assign subjects and teachers' },
    ],
  },
  {
    label: 'Attendance',
    items: [
      { key: 'attendance.view.self', label: 'See own attendance' },
      { key: 'attendance.view.child', label: 'See their child’s attendance' },
      { key: 'attendance.view.class', label: 'See a class register' },
      { key: 'attendance.view.school', label: 'See attendance for the whole school' },
      { key: 'attendance.mark', label: 'Mark the register' },
    ],
  },
  {
    label: 'Coursework and results',
    items: [
      { key: 'timetable.view', label: 'See the timetable' },
      { key: 'homework.view', label: 'See homework' },
      { key: 'homework.create', label: 'Set homework' },
      { key: 'homework.update', label: 'Mark homework done' },
      { key: 'result.view.self', label: 'See own report card' },
      { key: 'result.view.child', label: 'See their child’s report card' },
      { key: 'result.view.class', label: 'See a class’s results' },
      { key: 'result.enter', label: 'Enter marks' },
      { key: 'result.publish', label: 'Publish results' },
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
      { key: 'substitution.manage', label: 'Arrange cover for absent teachers' },
      { key: 'payroll.view', label: 'See payslips' },
      { key: 'payroll.manage', label: 'Run payroll' },
    ],
  },
  {
    label: 'Students and money',
    items: [
      { key: 'student.view', label: 'See the student directory' },
      { key: 'student.manage', label: 'Admit and edit students' },
      { key: 'fee.view.child', label: 'See their child’s fees' },
      { key: 'fee.view.school', label: 'See fees for the whole school' },
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
      { key: 'visit.view', label: 'See school visits' },
      { key: 'visit.request', label: 'Request a visit' },
      { key: 'visit.approve', label: 'Approve visits and check visitors in' },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const COMMON = ['dashboard.view', 'notification.view', 'circular.view', 'event.view', 'map.view'];

const PARENT = [
  ...COMMON, 'timetable.view', 'attendance.view.child', 'homework.view',
  'result.view.child', 'fee.view.child', 'fee.pay', 'transport.view',
  'transport.request', 'request.raise', 'request.view.self', 'meeting.view',
  'meeting.book', 'visit.view', 'visit.request', 'library.view',
];

const STUDENT = [
  ...COMMON, 'timetable.view', 'attendance.view.self', 'homework.view',
  'homework.update', 'result.view.self', 'library.view', 'library.borrow',
  'transport.view', 'request.raise', 'request.view.self', 'meeting.view',
  'visit.view', 'lab.view',
];

/** What any teacher may do, whatever grade they teach. */
const SUBJECT_TEACHER = [
  ...COMMON, 'timetable.view', 'attendance.view.class', 'homework.view',
  'homework.create', 'result.view.class', 'result.enter', 'student.view',
  'staff.view', 'leave.request', 'substitution.view', 'library.view',
  'transport.view', 'meeting.view', 'visit.view', 'payroll.view', 'lab.view',
  'academic.view', 'request.view.all',
];

/** A class teacher additionally owns the register and the class's parents. */
const CLASS_TEACHER = [
  ...SUBJECT_TEACHER, 'attendance.mark', 'circular.post', 'meeting.manage',
  'request.resolve', 'visit.approve',
];

const HEAD = [
  ...CLASS_TEACHER, 'attendance.view.school', 'result.publish', 'academic.manage',
  'staff.manage', 'recruitment.view', 'recruitment.review', 'leave.approve',
  'substitution.manage', 'student.manage', 'report.view', 'circular.delete',
  'lab.manage', 'org.view', 'role.view',
];

/**
 * The default permission set for each role. A school can change these on the
 * Roles screen; the edited version is kept separately so an upgrade does not
 * silently reinstate a permission the school removed.
 */
export const ROLE_CATALOGUE: Record<Role, { name: string; blurb: string; permissions: string[] }> = {
  'group-admin': {
    name: 'Group Administrator',
    blurb: 'The trust’s own account. Opens branches and appoints their administrators.',
    permissions: [...HEAD, 'org.manage', 'role.manage', 'settings.manage', 'fee.view.school', 'payroll.view', 'transport.compliance'],
  },
  correspondent: {
    name: 'Correspondent',
    blurb: 'Legal head of the school under the Directorate of School Education.',
    permissions: [
      ...HEAD, 'role.manage', 'settings.manage', 'fee.view.school', 'fee.collect',
      'payroll.view', 'payroll.manage', 'library.manage', 'transport.manage',
      'transport.compliance',
    ],
  },
  principal: {
    name: 'Principal',
    blurb: 'Runs the school day to day and signs off on appointments.',
    permissions: [...HEAD, 'fee.view.school', 'settings.manage'],
  },
  headmaster: {
    name: 'Headmaster / Headmistress',
    blurb: 'Heads the primary section.',
    permissions: [...HEAD],
  },
  'vice-principal': {
    name: 'Vice Principal',
    blurb: 'Academic coordination — timetable, cover and discipline.',
    permissions: [
      ...CLASS_TEACHER, 'attendance.view.school', 'substitution.manage',
      'leave.approve', 'academic.view', 'academic.manage', 'result.publish',
      'staff.view', 'report.view',
    ],
  },
  'office-superintendent': {
    name: 'Office Superintendent',
    blurb: 'Admissions, records, certificates and the front desk.',
    permissions: [
      ...COMMON, 'student.view', 'student.manage', 'staff.view', 'academic.view',
      'attendance.view.school', 'request.view.all', 'request.resolve',
      'visit.view', 'visit.approve', 'meeting.view', 'meeting.manage',
      'transport.view', 'transport.manage', 'circular.post', 'report.view',
      'recruitment.view', 'leave.request', 'payroll.view',
    ],
  },
  'accounts-officer': {
    name: 'Accounts Officer',
    blurb: 'Fee collection, receipts and the defaulter list.',
    permissions: [
      ...COMMON, 'fee.view.school', 'fee.collect', 'student.view', 'report.view',
      'transport.view', 'visit.view', 'visit.approve', 'meeting.view',
      'leave.request', 'payroll.view',
    ],
  },
  'payroll-officer': {
    name: 'Payroll Officer',
    blurb: 'Salary, PF and ESI. Usually the same person as Accounts.',
    permissions: [
      ...COMMON, 'payroll.view', 'payroll.manage', 'staff.view', 'report.view',
      'leave.request',
    ],
  },
  'class-teacher': {
    name: 'Class Teacher',
    blurb: 'Owns one class — its register, its parents and its report cards.',
    permissions: CLASS_TEACHER,
  },
  'subject-teacher': {
    name: 'Subject Teacher',
    blurb: 'Teaches a subject across several classes.',
    permissions: SUBJECT_TEACHER,
  },
  librarian: {
    name: 'Librarian',
    blurb: 'Accession, issue, return and fines.',
    permissions: [
      ...COMMON, 'library.view', 'library.manage', 'library.borrow', 'student.view',
      'staff.view', 'leave.request', 'payroll.view', 'visit.view',
    ],
  },
  'lab-incharge': {
    name: 'Lab In-charge',
    blurb: 'Responsible for a laboratory, its batches and its apparatus.',
    permissions: [
      ...SUBJECT_TEACHER, 'lab.manage', 'lab.breakage.record', 'academic.view',
    ],
  },
  'lab-assistant': {
    name: 'Lab Assistant',
    blurb: 'Sets up practicals and keeps the apparatus register.',
    permissions: [
      ...COMMON, 'lab.view', 'lab.breakage.record', 'student.view', 'timetable.view',
      'leave.request', 'payroll.view',
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
  warden: {
    name: 'Warden',
    blurb: 'Hostel supervision.',
    permissions: [
      ...COMMON, 'student.view', 'attendance.view.school', 'leave.request',
      'payroll.view', 'visit.view',
    ],
  },
  parent: { name: 'Parent', blurb: 'Sees only their own children.', permissions: PARENT },
  student: { name: 'Student', blurb: 'Sees only their own record.', permissions: STUDENT },
};

/** Roles ordered by seniority, used to pick the label shown for a person. */
const SENIORITY: Role[] = [
  'group-admin', 'correspondent', 'principal', 'headmaster', 'vice-principal',
  'office-superintendent', 'accounts-officer', 'payroll-officer', 'transport-incharge',
  'librarian', 'lab-incharge', 'warden', 'class-teacher', 'subject-teacher',
  'lab-assistant', 'parent', 'student',
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

    // Schools hand parents the child's student ID, not an email address — so
    // an admission number signs in the guardian linked to that student.
    let found = db.users.find((u) => u.email.toLowerCase() === identifier);
    if (!found) {
      const student = db.users.find(
        (u) => u.roles.includes('student') && u.admissionNo?.toLowerCase() === identifier,
      );
      if (student) {
        found = db.users.find((u) => u.id === student.guardianIds?.[0]) ?? student;
      }
    }
    if (!found) return { ok: false, error: 'No account found for that email or student ID.' };
    if (found.password !== password) return { ok: false, error: 'That password is incorrect.' };
    if (found.status !== 'active') {
      return { ok: false, error: 'This account is inactive. Please contact the school office.' };
    }
    writeSession(found.id);
    // Everyone lands on their own school. The trust's account can move between
    // branches afterwards; nobody else is offered the choice.
    setActiveBranch(found.schoolId);
    return { ok: true, user: present(found) };
  },

  restore(): AuthUser | null {
    const id = readSession();
    if (!id) return null;
    const found = getDatabase().users.find((u) => u.id === id);
    if (!found || found.status !== 'active') return null;

    const user = present(found);
    // The chosen branch outlives a reload, which is right for the trust's
    // account. For anyone else it must not: on a shared office machine they
    // would otherwise come back to whichever branch was last looked at.
    if (!user.permissions.includes('org.view')) setActiveBranch(found.schoolId);
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
