/**
 * Colour-scheme (light / dark / system) state for the mobile app.
 *
 * Mirrors the web provider (frontend/src/lib/theme.tsx): the same tri-state
 * preference, the same server-side persistence at `users/me.preferences.theme`,
 * same live 'system' re-resolution (via the RN Appearance API here). Colours
 * flow through context — spacing/typography/radius stay plain token imports.
 *
 * The default context is the DARK theme with a no-op setter so existing
 * components render sensibly in unit tests without a provider.
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
import { Appearance } from 'react-native';
import type { ThemeModePreference } from '@itp/shared';
import { darkColors, lightColors, type ThemeColors } from './tokens';
import { useAuth } from '@/auth/auth-context';
import { kvGet, kvSet } from '@/db/database';
import { updateMyPreferences } from '@/api/endpoints';

export type ThemePreference = ThemeModePreference;
export type ResolvedScheme = 'light' | 'dark';

const THEME_KV_KEY = 'prefs.theme';
const DEVICE_SCOPE = '__device__';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function resolveScheme(preference: ThemePreference, systemScheme: ResolvedScheme): ResolvedScheme {
  return preference === 'system' ? systemScheme : preference;
}

/** OS appearance through the Appearance API; dark when unavailable (tests). */
export function detectSystemScheme(): ResolvedScheme {
  const scheme = Appearance.getColorScheme?.();
  return scheme === 'light' ? 'light' : 'dark';
}

interface ThemeContextValue {
  /** 'light' | 'dark' | 'system' — the user's stored choice. */
  preference: ThemePreference;
  /** The effective scheme after resolving 'system'. */
  scheme: ResolvedScheme;
  /** The active palette. */
  colors: ThemeColors;
  setPreference: (preference: ThemePreference) => void;
}

const DARK_DEFAULT: ThemeContextValue = {
  preference: 'system',
  scheme: 'dark',
  colors: darkColors,
  setPreference: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(DARK_DEFAULT);

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Build a StyleSheet once per scheme. `factory` must be a stable (module
 * level) function for memoisation to work:
 *   const createStyles = (colors: ThemeColors) => StyleSheet.create({ ... });
 *   const styles = useThemedStyles(createStyles);
 */
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { user } = useAuth();
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = kvGet<unknown>(DEVICE_SCOPE, THEME_KV_KEY);
    return isThemePreference(stored) ? stored : 'system';
  });
  const [systemScheme, setSystemScheme] = useState<ResolvedScheme>(detectSystemScheme);
  // Guard against adopt → persist → reflect loops: remember what we adopted.
  const adoptedRef = useRef<string | null>(null);
  const userId = user?.id ?? null;
  const serverTheme = user?.preferences?.theme;

  // OS appearance changes re-resolve 'system' live.
  useEffect(() => {
    const sub = Appearance.addChangeListener?.(({ colorScheme }: { colorScheme: string | null | undefined }) => {
      setSystemScheme(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => sub?.remove?.();
  }, []);

  // Preference resolution order per sign-in: the server-stored choice wins
  // (cross-device sync); otherwise fall back to this device's stored choice
  // for that user; otherwise keep the current value.
  useEffect(() => {
    if (!userId) return;
    const server = isThemePreference(serverTheme) ? serverTheme : null;
    const local = kvGet<unknown>(userId, THEME_KV_KEY);
    const next = server ?? (isThemePreference(local) ? local : null);
    if (!next) return;
    const key = `${userId}:${next}`;
    if (adoptedRef.current === key) return;
    adoptedRef.current = key;
    try {
      // Mirror into the device store so the choice survives offline sessions.
      kvSet(userId, THEME_KV_KEY, next);
    } catch {
      /* best effort */
    }
    setPreferenceState((current) => (current === next ? current : next));
  }, [userId, serverTheme]);

  const setPreference = useCallback(
    (next: ThemePreference): void => {
      setPreferenceState(next);
      const scope = userId ?? DEVICE_SCOPE;
      adoptedRef.current = userId ? `${userId}:${next}` : null;
      try {
        kvSet(scope, THEME_KV_KEY, next);
      } catch {
        /* device-local persistence is best effort */
      }
      // Mirror to the profile so the web app and other devices follow.
      // Best effort: offline (or any) failure leaves the device choice intact
      // and the next successful sign-in re-syncs.
      if (userId) {
        const preferences: Record<string, unknown> = {
          ...(user?.preferences ?? {}),
          theme: next,
        };
        void updateMyPreferences(preferences).catch(() => {});
      }
    },
    [userId, user?.preferences],
  );

  const value = useMemo<ThemeContextValue>(() => {
    const scheme = resolveScheme(preference, systemScheme);
    return { preference, scheme, colors: scheme === 'light' ? lightColors : darkColors, setPreference };
  }, [preference, systemScheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
