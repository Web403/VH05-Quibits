# THEME_MODES.md

Light / dark / system colour-scheme support for BOTH clients, plus the shared
server-side persistence contract. This is the single source of truth for how
theming works; the per-platform design system docs link here.

## Contract

- Three preferences: `light`, `dark`, `system` (follow the OS appearance and
  re-resolve live when the OS flips).
- Default is `system`. Nothing ever requires the user to pick: a new device
  shows dark or light purely from the OS.
- Persistence is **server-first**: the choice lives at
  `users/me.preferences.theme` (schema: `z.enum(['light','dark','system'])`)
  and cross-syncs web ↔ mobile ↔ other devices. Each client also keeps a
  device-local copy so the preference survives offline and applies instantly
  on launch (web: `localStorage['itp.theme']`; mobile: SQLite `kv` key
  `prefs.theme`, scoped per user with a device fallback).
- `PublicUser.preferences` is projected by the backend
  (`backend/src/modules/auth/auth.service.ts` → `toPublicUser`), malformed
  theme values are sanitised to `null`, and the strict `preferences` patch
  object carries `locale?` / `theme?` / `timezone?` only. `PATCH /users/me`
  **replaces** the preferences object wholesale — clients merge existing keys
  before sending (both providers do this).
- Server updates are best-effort: offline PATCH failures keep the device-local
  choice; the next sign-in re-reads the profile and wins (server value beats
  the device default). Theme never triggers retry queues — it is cosmetic
  state, not operational data.

## Web (`frontend/`)

- CSS-variable driven. Implementation = `lib/theme.tsx` (ThemeProvider inside
  AuthProvider in `main.tsx`) toggling `<html data-theme="light|dark">`.
  `styles/global.css` holds the dark tokens in `:root` and the light palette
  in `:root[data-theme='light']` (also flips `color-scheme`).
- The provider applies the stored/system scheme from a module side-effect at
  import time, before first paint — no dark→light flash.
- Entry points: top-bar cycle button (light → dark → system, glyph ☀/☾/◐,
  full `aria-label` naming current + next state) and Settings → Appearance
  radio cards with live "currently showing" note.
- Every status tone pairs colour with icon + text in markup; theme changes
  never alter meaning.
- Strong-tone tokens (`--fg-*-strong`, `--content-link`, `--accent`,
  `--color-warn-dark`, `--color-info-dark`) exist so no component file keeps a
  hardcoded hex; `components/ui.css` / `layouts/app-layout.css` are hex-free.

## Mobile (`apps/mobile/`)

- Palettes live as `darkColors` / `lightColors` in `src/theme/tokens.ts`
  (identical key set, enforced by `src/theme/theme.test.tsx`). The bare
  `colors` export was deliberately removed; screens get theme colours via
  `useTheme()` from `src/theme/theme.tsx` and build styles via
  `useThemedStyles(createStyles)` where `createStyles(colors: ThemeColors)` is
  a module-level factory.
- Theme-independent tokens (spacing, radius, type, minTouchTarget, …) stay
  plain imports.
- The ThemeProvider sits inside `AuthProvider` in `src/app/_layout.tsx`. Any
  theming UI (`<Stack>` contentStyle, the StatusBar) lives in the
  `ThemedRoot` component **below** the provider — calling `useTheme` above it
  returns the static dark default.
- StatusBar inverts: light interface → `dark` bar content and vice versa.
  `app.json` sets `"userInterfaceStyle": "automatic"` (it previously forced
  `dark`, which would block light mode on iOS).
- Entry point: Profile → Appearance (`ChoiceGroup` radio: System / Light /
  Dark).
- **Camera chrome exception**: the machine-QR scanner overlay and modal
  backdrops (fixed dark translucents in `scan.tsx`, `machine-confirm-sheet`,
  `modal-shell`) stay dark in both schemes — scanning over a partial-transparency
  dark mask keeps the camera vignette consistent and the white frame markers
  readable. This is intentional; don't "fix" it.

## Palette values

The light palette mirrors the web `[data-theme='light']` block:

| Token group | Dark | Light |
|---|---|---|
| App colors | `#0f1115` bg family | `#f2f4f8` bg family |
| Surfaces | `#171a21` / `#1e222b` | `#ffffff` / `#f0f3f8` |
| Text | `#e6e9ef` / `#9aa3b2` / `#6b7484` | `#121a26` / `#4d5a6e` / `#7c8898` |
| Accent | `#4493f8` (m), `#1f6feb→#388bfd` (w) | `#0b5fff`, hover `#2e5fe0`-family (`#2f66e8`) |
| Status | ok `#3fb950` warn `#d29922` error `#f85149` info `#58a6ff` | ok `#157347` warn `#8a5b00` error `#b3261e` info `#1d4fd7` |

Light-theme status hexes are chosen for ≥4.5:1 contrast where they render as
text; `*Bg` variants are 10–12 % alpha tints on both schemes.

## Accessibility & invariants carried over

- Status never by colour alone; both themes ship icon + label for every tone.
- Focus rings use `var(--color-info)` (web) / `colors.info` (mobile) — defined
  in both schemes.
- `prefers-reduced-motion` and the rest of FRONTEND_ACCESSIBILITY.md are
  theme-independent and untouched.

## What the hardcode audit fixed (2026-09-05)

A repo-wide hex scan after the first token pass found stragglers, all fixed:

- `components/ui.css` status badges/alerts (ok/info/warn) still carried
  dark-only foregrounds → new `--fg-ok/info/warn-strong` tokens per scheme;
  error variants now validated against the same pattern (`--fg-danger-strong`).
- `components/incidents.css` / `pages/chat.css` referenced custom properties
  that were never defined (`--color-ok-fg`, `--color-surface-alt`,
  `--color-*-fg/border`, `--color-link`) — so the incident detail and chat
  suggestion panels always rendered LIGHT boxes even in dark mode. All
  resolved to real scheme tokens; pre-existing dark-theme rendering bug fixed
  as part of this phase.
- Mobile primary-button text now uses `colors.onPrimary` (dark token
  corrected from the unused `#0b1220` to the shipped `#ffffff`).
- Intentional constants that stay literal: `#fff` text on accent buttons,
  the white surface behind QR codes (`machine-qr-card`), and the scanner's
  dark camera chrome (rgba values in `scan.tsx` / sheet backdrops).

WCAG ratios were computed for every light-theme text tone on all three light
surfaces (≥4.5:1 everywhere; hint-level `textSubtle` ≥3.2:1). The one
violation found — white text on the old `--accent-hover #336dff` (4.40) — was
fixed with `#2f66e8` (5.02).

## Verification

- Web: `frontend/src/lib/theme.test.tsx` (8 tests: resolution, storage,
  document attribute, live OS changes, server adoption, junk values). Layout
  tests wrap `ThemeProvider`. Frontend suite: 62 tests green; `vite build` OK.
- Mobile: `src/theme/theme.test.tsx` (palette parity/format, validation,
  resolution) + `src/theme/theme-provider.test.tsx` (adoption / persistence /
  server mirror against the real AuthProvider). All 39 styled files migrated and compile-checked (bare `colors`
  export removed on purpose so a hardcoded palette can't creep back);
  152 Jest tests green (incl. `theme-provider.test.tsx`: server adoption, kv persistence, merged PATCH, device-scope signed-out path), `tsc --noEmit` clean.
- Backend: `backend/tests/auth-preferences.test.ts` (4 tests: projection,
  malformed-theme sanitisation).
