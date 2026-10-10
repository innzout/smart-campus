import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

interface ThemeValue {
  /** What the user chose. */
  preference: ThemePref;
  /** What is actually on screen right now. */
  resolved: 'light' | 'dark';
  setPreference: (p: ThemePref) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
const KEY = 'scc.theme';

const systemTheme = () =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePref>(() => {
    try {
      const stored = localStorage.getItem(KEY) as ThemePref | null;
      return stored ?? 'system';
    } catch {
      return 'system';
    }
  });

  const [systemResolved, setSystemResolved] = useState<'light' | 'dark'>(systemTheme);

  // Track the OS setting so 'system' stays live rather than sampled once.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemResolved(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = preference === 'system' ? systemResolved : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setPreference = useCallback((p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
    [resolved, setPreference],
  );

  const value = useMemo(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
