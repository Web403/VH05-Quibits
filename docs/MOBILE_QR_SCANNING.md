# MOBILE_QR_SCANNING.md

Machine QR scanning for the Expo Go mobile workflow.

## Environment

- **Expo SDK 57** (`expo ~57.0.20`), Expo Router ~57, React Native 0.86.3.
- **Expo Go compatible** — no custom native build, no bare RN libraries.
- Packages (both bundled inside Expo Go for SDK 57):
  - `expo-camera@~57.0.4` — `CameraView` barcode scanning + permissions hook.
  - `expo-haptics@~57.0.2` — one success haptic per resolved machine.
- No photo/video capture; QR only (`barcodeTypes: ['qr']`).

## Flow

```
Home / Machines tab
      ↓ "Scan Machine" (primary action on Home, header action on Machines)
/(app)/scan — permission phase
      ↓  granted: camera + scanning frame
scan QR (qr only, latched after first detection)
      ↓  local validation (src/lib/qr.ts)   ← invalid codes never hit the API
GET /machines/resolve-qr/:qrValue  (autoRetry: false)
      ↓
MachineConfirmSheet (name, code, model, serial, location, status)
      ↓ "Open this machine"                 ↓ "Not this machine — scan again"
/(app)/machines/[id]                        scanner resumes, latch cleared
```

After a successful open, incident creation and the assistant both start from
the machine detail screen with the machine preserved (see below).

## Screen states (all implemented and test-covered)

| State | Presentation |
|---|---|
| Permission loading | Spinner |
| Permission prompt (can ask) | Explanation + “Allow camera access” + manual fallback |
| Permanently denied | Settings guidance (iOS/Android path) + manual fallback |
| Camera unavailable (`onMountError`) | Retry + manual fallback |
| Scanning | Preview, white frame, instruction, close, torch, manual-entry |
| Resolving | Paused + inline “Checking the machine…” (no alerts) |
| Invalid QR (local) | Inline error box, “Scan another code”, no API call |
| Invalid (backend 400) | Same inline presentation via `describeQrResolveError` |
| Unknown / unauthorized (404/403) | “Unknown machine” / “No access”; non-retryable |
| Rate-limited (429) / network | Retryable inline error + “Try again” |
| Success | One success haptic + confirmation bottom sheet |

## Duplicate scan & lifecycle safety

- A ref latch (`resolvingRef` + `lastValueRef`) plus the phase machine make a
  double-fire of the same code impossible, even across animation frames.
- The camera is given `active={phase === 'scanning'}` and the screen pauses
  via `useFocusEffect`; leaving the screen releases the camera.
- No vibration/sound loops: exactly one success haptic, nothing on errors.

## Manual machine-code entry (damaged labels)

“QR code damaged? Enter the machine code” opens a sheet where the technician
types the code (e.g. `CNC-001`). It calls the **same** `resolve` function as
the camera — same validation, endpoint, authorization, rate limit and error
copy. There is deliberately no separate lookup path.

## Incident & assistant integration after a scan

- Machine detail (opened from the scan) offers: Ask Assistant, Report
  incident, Manuals, Open incidents, Scan another machine.
- **Report incident** preselects the machine and its model in
  `incidents/create.tsx` (`?machineId=`), shows the machine prominently with
  a “verify this is the machine” note, and asks for confirmation before the
  machine can be changed. The machine id rides in the create payload.
- **Ask Assistant** (`machines/[id]/assistant`) finds/creates an active
  conversation for that machine via the backend; the backend attaches and
  validates machine context. Changing context deliberately = a new
  conversation, which prevents accidental carry-over from another machine.

## Permission text

`app.json` states: *“The camera is used only to scan machine QR codes so you
can open the right machine. Nothing is recorded or stored.”* — for both iOS
(`NSCameraUsageDescription`) and the `expo-camera` config plugin (Android
builds). In Expo Go the host app's own prompt is shown.

## Testing

- `apps/mobile/src/lib/qr.test.ts` — payload contract mirrored with the
  backend (`backend/tests/qr-parse.test.ts`).
- `apps/mobile/src/components/__tests__/scan-screen.test.tsx` — every state
  above, duplicate prevention, retry, manual fallback. Camera + haptics are
  mocked in `src/test/setup.ts`; no device needed.
- `backend/tests/qr.test.ts` — HTTP behaviour (needs a runnable mongod).
- Live check: `npm run bundle-check` (expo export) compiles the scanner into
  the Expo Go bundle.

## Known limits

- Torch control on/off only (no intensity), per `expo-camera`.
- Resolution requires connectivity — the safe machine summary is not cached
  (identifiers are cheap to re-fetch, and authorization must be live).
- Expo Go on iOS shows Expo's permission prompt; the app-level copy above
  applies to standalone builds.
