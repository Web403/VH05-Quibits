# MOBILE_FIELD_USABILITY.md

Field usability decisions and their rationale, for technicians in industrial
environments: one hand, gloves where practical, bad light, intermittent
connectivity, low tolerance for fiddly UI.

## One-handed use

- Primary actions sit top-of-flow (Home: *Scan Machine* first) or
  bottom-of-sheet (scanner: manual entry / retry within thumb reach).
- Targets ≥ 48 pt (tokens `minTouchTarget`), hero action 64 pt.
- Between-screen hops for the core loop: scan → confirm → open (3 taps),
  machine → report incident (1 tap, machine preselected).

## Gloves & motor precision

- Hardware-class controls are large and spaced: torch/close are 48 pt round
  buttons with hitSlop; choice chips are 48 pt tall; no swipe-only gestures
  (all actions also exist as buttons).
- Ten-key-friendly: numeric keyboard where measurements are entered
  (maintenance forms), `returnKeyType` submits tag entries.

## Light & environment

- Dark UI avoids bloom outdoors; the scanner frame is a high-contrast white
  outline with a shadowed caption; torch toggle supported via expo-camera.
- Typography is one size class up from consumer defaults
  (`type` tokens: body 16, subheading 17).

## Connectivity reality

- NetInfo drives: offline banner, React Query onlineManager (refetch on
  reconnect), and the sync engine (outbox in SQLite, backoff, review states).
- Copy is explicit about where data lives: “Saved on this device”, “waiting
  to sync”, “need review”, vs server-confirmed states.
- QR resolution requires a connection by design (authorization must be live)
  and says so plainly when it fails.
- Pull-to-refresh everywhere data is listed; refresh also kicks `syncNow()`.

## Repeated-task efficiency

- Home mirrors the shift: scan/search/report first, then *your* queue counts,
  recents (machines), pending sync.
- Machines tab: scan button, model filter chips, recents chips, debounced
  search across name/code/serial (+ model-name probe).
- Incident creation: recents chips, symptom suggestions, severity/priority
  presets — most reports are 4–6 taps + dictated text.
- Draft autosave means an interrupted report is restorable on the same form.

## Low-experience guardrails

- Plain-language errors (“No machine matches this code. Ask your supervisor
  to check the machine register.”) with a next step — never codes alone.
- Confirmations explain consequence + reversibility in one sentence.
- Machine-change protection: machine linked from scan/detail requires a
  confirmation to swap, and incident form shows the machine with a
  “verify this is the machine” note.
- The app cannot show invented states: badges/text are projections of
  backend fields only (no fake telemetry, no auto-resolved issues).

## Short-shift accessibility of the app itself

- Update path is Expo Go (internal distribution), no store review lag.
- Environment config is one LAN URL (`EXPO_PUBLIC_API_BASE_URL`); the login
  screen *warns* when it points at localhost from a physical device.
