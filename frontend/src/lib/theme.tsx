/**
 * Colour-scheme management (light / dark / system).
 *
 * The app is CSS-variable driven: this module only flips the `data-theme`
 * attribute on <html>, and `styles/global.css` swaps the token palette. The
 * preference is stored in localStorage per device and — when a user session
 * exists — mirrored to `users/me.preferences.theme` so the choice follows the
 * user across browsers and the mobile app (same shared contract).
 *
 * `system` tracks the OS appearance via matchMedia and re-resolves live.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ThemeModePreference } from '@itp/shared';
import { useAuth } from './auth';
import { apiClient } from './api-client';

export type ThemePreference = ThemeModePreference;
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'itp.theme';
const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isThemePreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(preference: ThemePreference, systemScheme: ResolvedTheme): ResolvedTheme {
  return preference === 'system' ? systemScheme : preference;
}

/** Current OS appearance; falls back to dark outside browsers / older DOMs. */
export function detectSystemScheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyToDocument(scheme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = scheme;
}

// Set the scheme before first paint so a stored light preference doesn't flash dark.
applyToDocument(resolveTheme(readStoredPreference(), detectSystemScheme()));

interface ThemeContextValue {
  /** The user's choice; `system` follows the OS. */
  preference: ThemePreference;
  /** The effective scheme after resolving `system`. */
  scheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user, updateUser } = useAuth();
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemScheme, setSystemScheme] = useState<ResolvedTheme>(detectSystemScheme);
  // Track which server value we already adopted so effect loops can't form.
  const adoptedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (): void => setSystemScheme(mq.matches ? 'light' : 'dark');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const scheme = resolveTheme(preference, systemScheme);

  useEffect(() => {
    applyToDocument(scheme);
  }, [scheme]);

  // Adopt the preference stored on the server profile (per device, first win:
  // the server value overrides the device default only when it differs).
  const serverTheme = user?.preferences?.theme;
  useEffect(() => {
    if (!serverTheme || !isThemePreference(serverTheme)) return;
    if (adoptedKeyRef.current === serverTheme) return;
    adoptedKeyRef.current = serverTheme;
    try {
      localStorage.setItem(STORAGE_KEY, serverTheme);
    } catch {
      /* private mode: keep the in-memory value */
    }
    setPreferenceState((current) => (current === serverTheme ? current : serverTheme));
  }, [serverTheme]);

  const setPreference = useCallback(
    (next: ThemePreference): void => {
      setPreferenceState(next);
      adoptedKeyRef.current = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* tolerated: device-local persistence is best effort */
      }
      // Mirror to the profile so other devices pick it up. Merge with the
      // existing preferences object — PATCH replaces it wholesale.
      if (user) {
        void apiClient
          .updateMe({ preferences: { ...(user.preferences ?? {}), theme: next } })
          .then(({ user: updated }) => updateUser(updated))
          .catch(() => {
            /* offline/validation issues: the device-local choice still applies */
          });
      }
    },
    [user, updateUser],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, scheme, setPreference }),
    [preference, scheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export { PREFERENCES as THEME_PREFERENCES };
