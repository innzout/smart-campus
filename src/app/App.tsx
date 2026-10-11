import { Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './auth';
import { ThemeProvider, useTheme } from './theme';
import { ErrorBoundary } from './ErrorBoundary';
import { Shell } from '@/components/layout/Shell';
import { permissionsForPath } from './nav';
import {
  Academics,
  Attendance,
  Branches,
  Circulars,
  Dashboard,
  Events,
  Fees,
  Homework,
  Labs,
  Library,
  Login,
  Meetings,
  NotFound,
  Notifications,
  Payroll,
  People,
  Recruitment,
  Requests,
  Results,
  Roles,
  SchoolMap,
  Settings,
  Substitutions,
  Timetable,
  Transport,
  Visits,
} from './routes';

function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-plane" role="status">
      <Loader2 className="size-6 animate-spin text-brand-500" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/**
 * Permission gate. Someone who reaches a page their role can't open is sent to
 * the dashboard rather than shown a 404 — the page exists, it isn't theirs.
 */
function Guard({ path, children }: { path: string; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const allowed = permissionsForPath(path);
  if (allowed.length && !allowed.some((p) => user.permissions.includes(p))) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Login />
    </Suspense>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      {/* The shell owns a Suspense boundary around its outlet, so a loading
          chunk swaps the page without unmounting the sidebar. */}
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="attendance" element={<Guard path="/attendance"><Attendance /></Guard>} />
        <Route path="homework" element={<Guard path="/homework"><Homework /></Guard>} />
        <Route path="results" element={<Guard path="/results"><Results /></Guard>} />
        <Route path="fees" element={<Guard path="/fees"><Fees /></Guard>} />
        <Route path="timetable" element={<Guard path="/timetable"><Timetable /></Guard>} />
        <Route path="circulars" element={<Guard path="/circulars"><Circulars /></Guard>} />
        <Route path="meetings" element={<Guard path="/meetings"><Meetings /></Guard>} />
        <Route path="visits" element={<Guard path="/visits"><Visits /></Guard>} />
        <Route path="events" element={<Guard path="/events"><Events /></Guard>} />
        <Route path="transport" element={<Guard path="/transport"><Transport /></Guard>} />
        <Route path="library" element={<Guard path="/library"><Library /></Guard>} />
        <Route path="requests" element={<Guard path="/requests"><Requests /></Guard>} />
        <Route path="campus" element={<Guard path="/campus"><SchoolMap /></Guard>} />
        <Route path="notifications" element={<Guard path="/notifications"><Notifications /></Guard>} />
        <Route path="students" element={<Guard path="/students"><People /></Guard>} />
        <Route path="academics" element={<Guard path="/academics"><Academics /></Guard>} />
        <Route path="recruitment" element={<Guard path="/recruitment"><Recruitment /></Guard>} />
        <Route path="substitutions" element={<Guard path="/substitutions"><Substitutions /></Guard>} />
        <Route path="labs" element={<Guard path="/labs"><Labs /></Guard>} />
        <Route path="payroll" element={<Guard path="/payroll"><Payroll /></Guard>} />
        <Route path="roles" element={<Guard path="/roles"><Roles /></Guard>} />
        <Route path="branches" element={<Guard path="/branches"><Branches /></Guard>} />
        <Route path="settings" element={<Settings />} />

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route
        path="*"
        element={
          <Suspense fallback={<FullPageLoader />}>
            <NotFound />
          </Suspense>
        }
      />
    </Routes>
  );
}

function AppToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      closeButton
      toastOptions={{
        style: {
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          color: 'var(--ink)',
          borderRadius: '14px',
          boxShadow: 'var(--shadow-pop)',
        },
      }}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
          <AppToaster />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
