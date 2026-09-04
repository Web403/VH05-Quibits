# MOBILE_DESIGN_SYSTEM.md

Central design system for the field app. Single source of truth:
`apps/mobile/src/theme/tokens.ts` + the UI kit in
`apps/mobile/src/components/ui.tsx`. Screens must compose these — no ad-hoc
hex values, no per-screen one-off controls.

## Principles

1. **Dark-first with first-class light**, mirroring the web system
   (`frontend/src/styles/global.css`) — shop floors run dim, and dark surfaces
   don't bloom in bright light. Both palettes ship; the user picks light /
   dark / system in Profile → Appearance (THEME_MODES.md).
2. **Status is never colour alone** — every badge pairs tint + icon + text.
3. **Glove-scale interaction** — minimum 48 pt targets, large typography.
4. **Suggested vs confirmed stays visually distinct** (platform invariant):
   same tone language as the web (`lib/labels.ts` mirrors
   `frontend/src/lib/labels.ts`).

## Colour schemes (theme/theme.tsx)

`tokens.ts` defines `darkColors` and `lightColors` with **identical keys**
(test-enforced in `theme.test.tsx`). Screens never hardcode a palette: get
`colors` from `useTheme()` and build styles through
`useThemedStyles(createStyles)` where `createStyles(colors: ThemeColors)` is a
module-level factory. Spacing/typography/radius stay theme-independent plain
imports. The user choice persists to `users/me.preferences.theme` (shared with
web) plus a local `kv` fallback; the Camera-screen chrome deliberately stays
dark in both schemes (THEME_MODES.md). The table below lists the dark values;
the light equivalents are documented next to the palette in `tokens.ts` and in
THEME_MODES.md.

## Tokens (theme/tokens.ts)

| Group | Values |
|---|---|
| Surface | `bg #0f1115`, `surface #171a21`, `surfaceRaised #1e222b`, `border #2a2f3a`, `borderStrong #3a4150` |
| Text | `text #e6e9ef`, `textMuted #9aa3b2`, `textSubtle #6b7484` (hints/secondary only) |
| Status tones | `ok #3fb950`, `warn #d29922`, `error #f85149`, `info #58a6ff`, `neutral #8b94a5`, each with a 12–16 % alpha `*Bg` |
| Accent | `primary #4493f8`, `primaryBg`, `onPrimary #ffffff` |
| Spacing | `xs 4, sm 8, md 16, lg 24, xl 32` |
| Radius | `sm 6, md 10, lg 14` (999 for pills) |
| Type | `title 24, heading 20, subheading 17, body 16, small 14, tiny 12` — deliberately large (`tokens.ts` documents why) |
| Touch | `minTouchTarget 48`, `hitSlop 10` (icon-only controls) |
| Inputs | `inputHeight 48`; multiline ≥ 100 |
| Icons | `iconSize sm 14 / md 20 / lg 28 / hero 34` |
| Elevation | `elevation.raised` (sheets/dialogs), `elevation.floating` (camera controls) — Android elevation + iOS shadow pair |

### Contrast notes (on `bg #0f1115`)

- `text` ≈ 13.6:1, `textMuted` ≈ 6.5:1 — AA/AAA for body text.
- `textSubtle` ≈ 3.9:1 — restricted to hints, timestamps and secondary labels
  (large text or non-essential info it is allowed for; never errors/actions).
- Status tones on their alpha backgrounds carry icon + label, so contrast
  shortfalls never hide information.
- The app is dark-only (`userInterfaceStyle: "dark"`); no light theme exists
  to drift.

## Components (components/ui.tsx)

- **Button** — variants `primary | secondary | danger | ghost`, sizes
  `md (≥48) | lg (≥56)`; `icon` renders an aria-hidden glyph (never inside
  the label → screen readers stay clean); `loading` shows “Working…” and
  disables; `accessibilityHint` supported.
- **TextField** — label (+ red `*` and “, required” in the accessibility
  label), `helper` line, error with `accessibilityLiveRegion="polite"`,
  email/numeric keyboards, `returnKeyType`/`onSubmitEditing` for field flow.
- **ChoiceGroup** — severity/priority/status selectors as large radio chips
  with icon + tone, `accessibilityRole="radio"`.
- **Badge / Chip** — icon + label + tone, `sm|md`.
- **Card, SectionTitle, KeyValue, StatTile** — layout primitives.
- **states.tsx** — `LoadingState`, `SkeletonList`, `EmptyState`, `ErrorState`,
  `InlineBanner`, `CachedNotice`, `PressableRow`.
- **banners.tsx** — `OfflineBanner`, `PendingSyncBanner`, `ConfirmDialog`
  (explicit confirm labels only — “Close incident”, never “Yes”).
- **machine-confirm-sheet.tsx** — post-scan machine confirmation bottom sheet.

## Usage rules for new screens

1. Import tokens; never hardcode colours/sizes.
2. One primary action per screen region; scan-class actions use `icon="▣"`.
3. Status → `lib/labels.ts` presentations; if a new status appears, add it
   there (mirroring the web) rather than inventing local badges.
4. Important confirmations go through `ConfirmDialog` with an explicit verb.
5. Lists use `FlatList` + `SkeletonList`/`EmptyState`/`ErrorState`; keyboard
   screens use `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"`.
