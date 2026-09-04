# MOBILE_UI_UX_GUIDELINES.md

UI/UX guidelines for the field app, distilled from the audit performed for
this phase (`docs/PHASE_QR_UI_IMPLEMENTATION.md` lists the concrete fixes).
Apply these to every new screen; they exist so the app stays a field tool,
not a desktop app squeezed into a phone.

## The technician's loop (screen design priority)

1. Identify the machine → 2. Understand the task → 3. Find information →
4. Perform & record work → 5. Confirm the result → 6. Escalate or close.

Anything that doesn't serve one of these steps on a given screen is clutter.

## Screen composition rules

- **One primary action** per region, visually dominant (e.g. *Scan Machine*
  on Home: 64 pt primary button at the top, before statistics).
- **Mobile-first density**: single column, cards, no tables/grids of data.
  Lists are `FlatList`s of row cards (≥64 pt) with 2–3 lines of content.
- **Identity before action**: screens that act on a machine/incident show its
  identity prominently first (`machine-identity` card, incident number +
  title). The technician must always be able to answer “which machine am I
  on?” without scrolling.
- **Suggest vs confirm**: AI output is a suggestion; technician records are
  facts. Suggestions never get checkmarks, and confirmations always use
  `ConfirmDialog` with explicit verbs (“Confirm successful result”, “Reopen
  incident”, “Save technician action” — never Yes/OK/Continue).
- **Offline honesty**: banners + per-screen `CachedNotice`; queued writes say
  “Saved on this device” until the server confirms. Never imply a record
  exists server-side before it does.

## State coverage (every screen, no exceptions)

| State | Component |
|---|---|
| Initial loading | `SkeletonList` (lists) / `LoadingState` (details) |
| Empty | `EmptyState` with a next-step action where one exists |
| Error | `ErrorState` with retry |
| Offline-with-copy | banner + `CachedNotice`, same layout as online |
| Partial failure mid-list | footer error + retry, keep loaded rows |

## Forms

- Break long forms into labeled sections; critical fields first (machine,
  title, description), selectors (ChoiceGroup, chips) before free text.
- Required fields: red `*` + `", required"` in the accessibility label.
- Helpers are one short sentence (“Printed on the machine label”).
- Keyboard: right keyboard per field, `returnKeyType` submit, KAV wrapper,
  taps persist.
- Interruption budget: autosave a local draft; leaving a dirty form asks
  (Keep editing / Leave (keep draft) / Discard). Drafts are recoverable,
  clearly labeled, and never look like server records.

## Confirmations

Dialog copy must state: what happens × reversibility × sync behaviour
× what information is required (e.g. close incident requires a resolution
summary). Destructive = `danger` variant + red confirm label.

## What we removed/avoided (audit outcome)

- Metrics dashboards or admin widgets on Home (kept: counts link to queues).
- Fake machine telemetry (“status” shown is the backend's register value).
- Desktop patterns: dense tables, hover affordances, tiny monospace dumps.
- Modal cascades: one sheet at a time (confirm sheet ⇒ machine screen).
- Glyph-only controls: every icon-only control has an accessibility label;
  button icons are decorative, labels carry the meaning.
