import { getDatabase } from '@/lib/store';
import type { Role, User } from '@/data/types';

/**
 * Demo authentication — entirely in the browser.
 *
 * The prototype runs with no server so a presentation can never be derailed by
 * a backend that didn't start. The permission model is real and is the same one
 * the API enforces; only the credential check is local.
 */

const SESSION_KEY = 'svm.session';

export interface AuthUser extends User {
  permissions: string[];
  roleName: string;
  /** For parents: the child currently being viewed. */
  activeChildId?: string;
}

/* ── permissions ───────────────────────────────────────────────────────── */

const PARENT: string[] = [
  'dashboard.view', 'timetable.view', 'attendance.view.child', 'homework.view',
  'result.view.child', 'fee.view.child', 'fee.pay', 'circular.view', 'event.view',
  'transport.view', 'request.raise', 'request.view.self', 'notification.view',
  'meeting.view', 'meeting.book', 'visit.view', 'visit.request', 'map.view',
  'library.view',
];

const STUDENT: string[] = [
  'dashboard.view', 'timetable.view', 'attendance.view.self', 'homework.view',
  'homework.update', 'result.view.self', 'circular.view', 'event.view',
  'library.view', 'library.borrow', 'transport.view', 'request.raise',
  'request.view.self', 'notification.view', 'map.view', 'meeting.view', 'visit.view',
];

const TEACHER: string[] = [
  'dashboard.view', 'timetable.view', 'attendance.view.class', 'attendance.mark',
  'homework.view', 'homework.create', 'result.view.class', 'result.enter',
  'circular.view', 'circular.post', 'event.view', 'student.view',
  'request.view.all', 'request.resolve', 'notification.view', 'map.view',
  'library.view', 'transport.view', 'meeting.view', 'meeting.manage',
  'visit.view', 'visit.approve',
];

const ROLE_PERMISSIONS: Record<Role, { name: string; permissions: string[] }> = {
  parent: { name: 'Parent', permissions: PARENT },
  student: { name: 'Student', permissions: STUDENT },
  teacher: { name: 'Class Teacher', permissions: TEACHER },
  principal: {
    name: 'Principal',
    permissions: [
      ...TEACHER, 'attendance.view.school', 'result.publish', 'fee.view.school',
      'student.manage', 'report.view', 'circular.delete',
    ],
  },
  accountant: {
    name: 'Accounts Officer',
    permissions: [
      'dashboard.view', 'fee.view.school', 'fee.collect', 'student.view',
      'circular.view', 'notification.view', 'report.view', 'transport.view', 'map.view',
      'visit.view', 'visit.approve', 'meeting.view',
    ],
  },
  librarian: {
    name: 'Librarian',
    permissions: [
      'dashboard.view', 'library.view', 'library.manage', 'library.borrow',
      'student.view', 'circular.view', 'notification.view', 'map.view', 'visit.view',
    ],
  },
  transport: {
    name: 'Transport In-charge',
    permissions: [
      'dashboard.view', 'transport.view', 'transport.manage', 'student.view',
      'circular.view', 'circular.post', 'notification.view', 'map.view', 'visit.view',
    ],
  },
  admin: {
    name: 'Correspondent',
    permissions: [
      ...TEACHER, 'attendance.view.school', 'result.publish', 'fee.view.school',
      'fee.collect', 'student.manage', 'staff.manage', 'report.view',
      'circular.delete', 'library.manage', 'transport.manage', 'settings.manage',
    ],
  },
};

export const permissionsForRole = (role: Role) => [
  ...new Set(ROLE_PERMISSIONS[role]?.permissions ?? []),
];

export const roleName = (role: Role) => ROLE_PERMISSIONS[role]?.name ?? role;

function present(user: User): AuthUser {
  return {
    ...user,
    permissions: permissionsForRole(user.role),
    roleName: roleName(user.role),
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
  login(email: string, password: string): { ok: true; user: AuthUser } | { ok: false; error: string } {
    const db = getDatabase();
    const identifier = email.trim().toLowerCase();

    // Schools hand parents the child's student ID, not an email address — so
    // an admission number signs in the guardian linked to that student.
    let found = db.users.find((u) => u.email.toLowerCase() === identifier);
    if (!found) {
      const student = db.users.find(
        (u) => u.role === 'student' && u.admissionNo?.toLowerCase() === identifier,
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
    return { ok: true, user: present(found) };
  },

  restore(): AuthUser | null {
    const id = readSession();
    if (!id) return null;
    const found = getDatabase().users.find((u) => u.id === id);
    return found && found.status === 'active' ? present(found) : null;
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
