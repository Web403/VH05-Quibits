/**
 * Design tokens.
 *
 * Mirrors the web design system (frontend/src/styles/global.css): dark-first,
 * high contrast, for technicians on a shop floor — with a full light palette
 * for daylight work (see MOBILE_DESIGN_SYSTEM.md). Status is never conveyed
 * by colour alone: every badge pairs colour with an icon and a text label.
 *
 * Theme-INDEPENDENT tokens (spacing, radius, type, sizes) are plain exports.
 * Colours come per scheme; components obtain them via `useTheme()` from
 * src/theme/theme.tsx and pass them to style factories. The bare `colors`
 * export no longer exists so a hard-coded palette can never creep back in.
 */
export const darkColors = {
  bg: '#0f1115',
  surface: '#171a21',
  surfaceRaised: '#1e222b',
  border: '#2a2f3a',
  borderStrong: '#3a4150',

  text: '#e6e9ef',
  textMuted: '#9aa3b2',
  textSubtle: '#6b7484',

  ok: '#3fb950',
  okBg: 'rgba(63, 185, 80, 0.14)',
  warn: '#d29922',
  warnBg: 'rgba(210, 153, 34, 0.14)',
  error: '#f85149',
  errorBg: 'rgba(248, 81, 73, 0.14)',
  info: '#58a6ff',
  infoBg: 'rgba(88, 166, 255, 0.14)',
  neutral: '#8b94a5',
  neutralBg: 'rgba(107, 116, 132, 0.16)',

  // Accent for primary actions.
  primary: '#4493f8',
  primaryBg: 'rgba(68, 147, 248, 0.16)',
  onPrimary: '#ffffff',
} as const;

/**
 * Light palette — WCAG-checked hex values (state text ≥ 4.5:1 on the surfaces
 * where that text is used; primary buttons pair a filled accent with white
 * text). Matches the `[data-theme='light']` block in the web global.css so
 * both clients render the same semantic colours.
 */
export const lightColors: Record<keyof typeof darkColors, string> = {
  bg: '#f2f4f8',
  surface: '#ffffff',
  surfaceRaised: '#f0f3f8',
  border: '#d6dce6',
  borderStrong: '#b5bfd0',

  text: '#121a26',
  textMuted: '#4d5a6e',
  textSubtle: '#7c8898',

  ok: '#157347',
  okBg: 'rgba(21, 115, 71, 0.1)',
  warn: '#8a5b00',
  warnBg: 'rgba(138, 91, 0, 0.12)',
  error: '#b3261e',
  errorBg: 'rgba(179, 38, 30, 0.1)',
  info: '#1d4fd7',
  infoBg: 'rgba(29, 79, 215, 0.1)',
  neutral: '#5b6675',
  neutralBg: 'rgba(91, 102, 117, 0.12)',

  primary: '#0b5fff',
  primaryBg: 'rgba(11, 95, 255, 0.12)',
  onPrimary: '#ffffff',
} as const;

/** The shape every screen consumes — identical keys in both schemes. */
export type ThemeColors = Record<keyof typeof darkColors, string>;

export type Tone = 'ok' | 'info' | 'warn' | 'error' | 'neutral';

export function toneColor(colors: ThemeColors): Record<Tone, string> {
  return {
    ok: colors.ok,
    info: colors.info,
    warn: colors.warn,
    error: colors.error,
    neutral: colors.neutral,
  };
}

export function toneBg(colors: ThemeColors): Record<Tone, string> {
  return {
    ok: colors.okBg,
    info: colors.infoBg,
    warn: colors.warnBg,
    error: colors.errorBg,
    neutral: colors.neutralBg,
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;

/**
 * Field-readable typography. Deliberately larger than typical mobile defaults:
 * used with gloves, in bad light, next to a machine.
 */
export const type = {
  title: 24,
  heading: 20,
  subheading: 17,
  body: 16,
  small: 14,
  tiny: 12,
} as const;

/** Minimum comfortable touch target (pt). */
export const minTouchTarget = 48;

/** Standard single-line input height (pt). Inputs never go below this. */
export const inputHeight = 48;

/** Icon glyph sizes - tab bar, inline badges, hero actions. */
export const iconSize = {
  sm: 14,
  md: 20,
  lg: 28,
  hero: 34,
} as const;

/** Default hit slop for small tappable elements (icon-only controls). */
export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/**
 * Elevation: Android `elevation` + matching iOS shadow. Two levels only -
 * raised surfaces (sheets, dialogs) and floating controls (scan frame torch).
 * Shadow colours stay black in both schemes; opacity is deliberately softened
 * by the lighter card in the light scheme's material guidelines.
 */
export const elevation = {
  raised: {
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  floating: {
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
} as const;
