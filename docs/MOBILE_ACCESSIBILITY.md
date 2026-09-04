# MOBILE_ACCESSIBILITY.md

Accessibility baseline for the field app (Expo / React Native APIs).

## Implemented

- **Labels & hints**: all interactive controls carry `accessibilityLabel`;
  buttons support `accessibilityHint` (e.g. *Scan Machine* → “Opens the
  camera to scan a machine QR code”); rows synthesize full sentences
  (`IncidentRow`: number, title, severity, status).
- **Roles**: buttons `button`, tabs via expo-router, radio chips
  `accessibilityRole="radio"` + selected state, headers `header`, modal
  dialogs `accessibilityViewIsModal`, links marked `link`.
- **Icons are decorative**: tab glyphs and button icons are separate
  aria-hidden elements — screen readers announce the label, never the glyph
  (fixed in this phase; previously glyphs were glued into label text).
- **Never colour alone**: every status = tone + icon + text (shared label
  catalog `src/lib/labels.ts`, mirroring the web's FRONTEND_ACCESSIBILITY
  convention).
- **Touch targets**: ≥ 48 pt platform-wide (`tokens.minTouchTarget`), 10 pt
  `hitSlop` on icon-only controls (scanner close/torch).
- **Required fields**: visible `*` *and* `", required"` appended to the
  field's accessibility label.
- **Errors announced**: field errors render with
  `accessibilityLiveRegion="polite"` (Android) and remain visible text
  (not toasts).
- **Progress/loading**: `LoadingState` uses `accessibilityRole="progressbar"`
  with the loading label.
- **Contrast** (dark-first palette): body text ≈ 13.6:1, muted ≈ 6.5:1,
  subtle ≈ 3.9:1 (hints only). See `docs/MOBILE_DESIGN_SYSTEM.md` for the
  full table.

## Scanner-specific

- The scanning frame is decorative; the *instruction* is real text
  (“Align the machine QR code inside the frame.”).
- Torch + close are labelled 48 pt controls; the success haptic supplements
  (never replaces) the visible confirmation sheet.
- Every scanner failure state is a text explanation + labeled action, so a
  screen-reader user can complete the whole flow via manual code entry.

## Known platform limits (documented, accepted)

- React Native focus order inside modals is best-effort; dialog content is
  kept short and controls linear to compensate.
- `accessibilityLiveRegion` is Android-only; iOS users still get persistent
  error text + `accessibilityErrorMessage` is not consistently supported —
  hence text, not toasts, for errors.
- ChoiceGroup exposes radio semantics per-chip; there is no single
  `radiogroup` container role on iOS (RN limitation).
