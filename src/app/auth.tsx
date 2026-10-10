import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useDatabase } from '@/lib/store';
import { authService, permissionsForRole, roleName, type AuthUser } from '@/services/auth.service';
import type { User } from '@/data/types';

interface AuthValue {
  user: AuthUser | null;
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  can: (permission: string) => boolean;
  /** The student this session is about — the user, or a parent's selected child. */
  subject: User | null;
  setActiveChild: (studentId: string) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useDatabase();
  const [userId, setUserId] = useState<string | null>(() => authService.restore()?.id ?? null);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);

  // Resolve against the live store so an edit shows up immediately, and a user
  // removed mid-session is signed out rather than left dangling.
  const user = useMemo<AuthUser | null>(() => {
    const found = db.users.find((u) => u.id === userId);
    if (!found) return null;
    return {
      ...found,
      permissions: permissionsForRole(found.role),
      roleName: roleName(found.role),
      activeChildId: activeChildId ?? found.childIds?.[0],
    };
  }, [db.users, userId, activeChildId]);

  /**
   * Most pages are about one student. For a student that is themselves; for a
   * parent it is the child they are viewing. Resolving it once here keeps every
   * page from re-deriving it.
   */
  const subject = useMemo<User | null>(() => {
    if (!user) return null;
    if (user.role === 'student') return user;
    if (user.role === 'parent') {
      const id = activeChildId ?? user.childIds?.[0];
      return db.users.find((u) => u.id === id) ?? null;
    }
    return null;
  }, [user, activeChildId, db.users]);

  const login = useCallback<AuthValue['login']>((email, password) => {
    const result = authService.login(email, password);
    if (!result.ok) return { ok: false, error: result.error };
    setUserId(result.user.id);
    setActiveChildId(result.user.childIds?.[0] ?? null);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUserId(null);
    setActiveChildId(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      login,
      logout,
      subject,
      setActiveChild: setActiveChildId,
      can: (permission) => user?.permissions.includes(permission) ?? false,
    }),
    [user, login, logout, subject],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The signed-in user, asserted non-null — for use inside protected routes. */
export function useCurrentUser() {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside a protected route');
  return user;
}

/**
 * The student the current page is about. Throws for staff roles, which should
 * use the class- or school-wide views instead.
 */
export function useSubjectStudent() {
  const { subject } = useAuth();
  return subject;
}

export function useCan() {
  return useAuth().can;
}
