# PHASE_QR_UI_IMPLEMENTATION.md

Mobile UI/UX hardening + machine QR scanning. Built on the existing stack:
Expo Go field app (`apps/mobile`, SDK 57), Express API, MongoDB, React web
app — no new services, no new database, no duplicated business logic.

## Audit findings (pre-change state)

Verified by reading every mobile screen, the design tokens, offline/sync
logic, backend machine module, and running typecheck + the 112-test suite.

**UI/UX**
1. No machine identification fast-path (no QR scanning, no code entry).
2. Home inverted the field priorities: statistics before actions; actions
   were four equal secondary buttons, scan absent.
3. Bug: machine detail *Report incident* passed `?machineId=` but
   `incidents/create` ignored the param — the form arrived unselected.
4. Machine identity on detail was a small KeyValue row; no "scan another".
5. Machines tab: no scan entry, no model filter, recents only on Home.
6. Buttons glued glyphs into labels (`"✦  Ask Assistant"`), making screen
   readers announce icons; `TextField` had no required markers/helpers.
7. No unsaved-form protection; no draft recovery on the one long form.

**Navigation** — 5-tab structure matched the target already; header titles
were generic on machine sub-screens ("Machine incidents") so machine context
was lost one level deep; no scan route existed.

**Field usability** — good bones (48 pt targets, offline banners, outbox
honesty, skeleton/empty/error states, pull-to-refresh, debounced search);
gaps were the missing scanner, torch, haptic, and scan-first layout.

**Accessibility** — see MOBILE_ACCESSIBILITY.md; worst offenders were
glyph-in-label buttons and unannounced required fields.

**Performance** — sound (FlatList, pagination, cache-first revisits,
no polling except sync). Issues found were minor and kept documented.

## What changed

### Mobile — QR scanning (new)
- `src/lib/qr.ts` — canonical payload builder, parser, error mapper; a pure
  mirror of the backend contract (`backend/tests/qr-parse.test.ts`).
- `src/api/types.ts` — `MachineQrSummary`; `src/api/endpoints.ts` —
  `resolveMachineQr` (no auto-retry).
- `src/app/(app)/scan.tsx` — full scanner: permission phases
  (loading/prompt/permanently-denied), camera-unavailable state, QR-only
  `CameraView`, frame + instruction + close + torch + manual entry, latch
  against duplicate detection, one success haptic, error mapping, and the
  confirmation bottom sheet (`src/components/machine-confirm-sheet.tsx`) —
  machine identity confirmed by a human before anything opens.
- Manual machine-code entry goes through the *same* resolve flow.
- `app.json` — honest camera permission copy (iOS + expo-camera plugin);
  packages `expo-camera ~57.0.4`, `expo-haptics ~57.0.2` (Expo-Go bundled).

### Mobile — UI/UX improvements
- `src/lib/home-actions.ts` + `home.tsx` — field-action-first Home: one
  64 pt primary *Scan Machine*, then Search/Create/My Work/Assistant; stats,
  sync card, recents below. Glyphs moved into aria-hidden icon slots.
- `machines.tsx` (tab) — scan button, model filter chips, recents chips,
  helper text; empty state offers scanning.
- `machines/[machineId]/index.tsx` — oversized identity card (name, code,
  SN, model, location, badges), action grid incl. *Scan another machine*;
  `incidents.tsx`/`manuals.tsx` headers now name the machine.
- `incidents/create.tsx` — `?machineId=` preselection + prominent display +
  confirmation before machine change; draft autosave/restore/discard via
  `src/lib/drafts.ts`; unsaved-changes `beforeRemove` guard with explicit
  choices (Keep editing / Leave (keep draft) / Discard report).
- `components/ui.tsx` — Button `icon`/`accessibilityHint`; TextField
  `required` (visual + announced), `helper`, live error region,
  `returnKeyType`/`onSubmitEditing`.
- `theme/tokens.ts` — `inputHeight`, `iconSize`, `hitSlop`, `elevation`.

### Backend (minimal, additive)
- `GET /api/v1/machines/resolve-qr/:qrValue` (registered before `/:id`):
  zod-bounded param, strict `parseMachineQrValue`, case-insensitive unique-
  index lookup, `machine.read` capability, per-IP rate limiter (60/min),
  org check via `resolveActorOrg` (foreign → same 404 as unknown), audit
  `machine.qr_resolved`, safe typed summary. Files: `machines.{routes,
  controller,service,validators}.ts`, `middleware/rate-limit.ts`,
  `audit.service.ts` (one action constant).

### Web (minimal, admin-facing)
- `frontend/src/components/machine-qr-card.tsx` on the machine detail
  overview — renders `machine:<asset-tag>` (client-side, `qrcode.react`),
  PNG download, print label. Also fixed one pre-existing typecheck error in
  `manual-upload-page.test.tsx` (`calls[0]?.[0]`); it predates this phase
  and blocked `npm run typecheck`.

## Files created / modified

**Created** — `backend/tests/qr.test.ts`, `backend/tests/qr-parse.test.ts`;
`apps/mobile/src/{lib/qr.ts, lib/qr.test.ts, lib/drafts.ts, lib/drafts.test.ts,
lib/home-actions.ts, lib/home-actions.test.ts, app/(app)/scan.tsx,
components/machine-confirm-sheet.tsx, components/__tests__/scan-screen.test.tsx}`;
`frontend/src/components/machine-qr-card.{tsx,test.tsx}`; docs: this file +
MACHINE_QR_FORMAT, QR_SECURITY_MODEL, MOBILE_QR_SCANNING,
MOBILE_DESIGN_SYSTEM, MOBILE_UI_UX_GUIDELINES, MOBILE_FIELD_USABILITY,
MOBILE_NAVIGATION_GUIDE, MOBILE_ACCESSIBILITY, MOBILE_PERFORMANCE,
MOBILE_ENVIRONMENT, EXPO_GO_SETUP (the last two close dead links from
`apps/mobile/.env.example`).

**Modified** — backend machine module + rate-limit + audit action;
`apps/mobile/{app.json, package.json, src/test/setup.ts,
src/theme/tokens.ts, src/api/{types,endpoints}.ts, src/components/ui.tsx,
src/components/__tests__/components.test.tsx, src/hooks/queries.ts,
src/app/(app)/(tabs)/home.tsx, src/app/(app)/(tabs)/machines.tsx,
src/app/(app)/incidents/create.tsx, machine detail + incidents + manuals
screens}`; `frontend/package.json`, `machine-detail-page.tsx`;
`docs/API_REFERENCE.md`.

## Dependencies added

- `apps/mobile`: `expo-camera ~57.0.4`, `expo-haptics ~57.0.2` (both inside
  Expo Go for SDK 57 — confirmed via `expo/bundledNativeModules.json`).
- `frontend`: `qrcode.react ^4.2.0` (React 18 compatible, renders locally).

## Tests

- Mobile: **143 passing** (112 kept + 31 new): qr lib contract, scanner
  states (permissions x4, valid/invalid/unknown/403/429/network, duplicate
  prevention, retry, manual fallback, navigation), home actions, drafts,
  UI-kit additions. `jest-expo`; camera/haptics/router mocked.
- Backend: `qr-parse.test.ts` (DB-free) **3 passing** here;
  `qr.test.ts` (supertest integration: 401/400/404/foreign-org/soft-delete/
  safe-summary/audit) — needs a runnable mongod; this sandbox cannot
  download mongodb-memory-server binaries, the same environmental limit
  that skips all 148 pre-existing DB-backed suites here. Backend typecheck
  clean; config suite 16/16.
- Frontend: **54 passing** (incl. 3 QR card tests), typecheck clean after
  the one-line pre-existing fix.

## Expo Go commands

```bash
cd apps/mobile
cp .env.example .env   # set EXPO_PUBLIC_API_BASE_URL to your LAN IP:8080/api/v1
npm install
npm start              # Expo Go QR in terminal; npm run start:lan / start:tunnel
npm test               # 143 tests, no device needed
npm run bundle-check   # metro production bundle (verified in this phase: 4.7 MB, contains resolve-qr route)
```

## Verification performed in this phase

- `npm run typecheck` clean in mobile, backend, frontend.
- Mobile Jest 13 suites/143 tests green; frontend Vitest 54 green.
- `expo export --platform android` succeeds with the scanner included.
- Frontend production build (`tsc -b && vite build`) succeeds.

## Known limits

- Backend integration suite for the QR endpoint written but not executed in
  this sandbox (no mongod download allowed); run `npm run test:backend`
  where Mongo is available — all other suites are affected equally there.
- QR resolution requires connectivity (authorization must be live); manual
  entry and cached machine views remain available offline.
- Torch is on/off only; Expo Go iOS shows Expo's permission prompt copy.
- The `mobileApp/` directory remains a deprecated stub (no source); the real
  app is `apps/mobile`. Left untouched.

## Explicitly NOT in this phase

Predictive maintenance, telemetry/IoT, voice or image diagnosis, autonomous
actions, QR deep-link authorization, signed QR rotation, offline QR
resolution, a QR printing management system, and any Phase-6+ roadmap item.
