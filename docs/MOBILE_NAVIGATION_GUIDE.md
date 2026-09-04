# MOBILE_NAVIGATION_GUIDE.md

Navigation structure of the field app (Expo Router file-based routes under
`apps/mobile/src/app`).

## Map

```
index.tsx                    → session splash → redirect
(auth)/
  login · forgot-password    → guard: authenticated users bounce to Home
(app)/                       → protected (AuthGate in root layout)
  (tabs)/
    home · work · machines · assistant · profile
  scan.tsx                   → QR scanner (push; close returns via router.back)
  incidents/create           → accepts ?machineId=
  incidents/[incidentId]/    → index · actions · fixes · root-cause · similar · timeline · edit
  machines/[machineId]/      → index · incidents · manuals · assistant
  conversations/new · conversations/[conversationId]
  manuals/[manualId]
```

## Rules

1. **Five tabs, no more**: Home, My Work, Machines, Assistant, Profile. Deep
   content is *pushed* on top of tabs, never additional tabs.
2. **Deep links forward, stack back**: machine → incidents → incident;
   incident → machine; incident → assistant (conversation). Back always
   returns through the path the technician took (scanner → machine keeps the
   scanner under it, so “scan again” is one Back).
3. **Context in titles**: machine sub-screens name the machine
   (“Mill A — incidents”, “Mill A — manuals”); the incident header is the
   incident number; the scanner is full-screen with its own close control.
4. **Guards at the gate, not in screens**: the root `AuthGate`
   (`authRedirect` in `lib/navigation.ts`, unit-tested) handles
   unauthenticated → /login, authenticated-in-auth-area → Home, and session
   expiry (401 → single refresh → expire banner on login).
5. **Unsaved forms protect themselves**: `incidents/create` intercepts
   `beforeRemove` and offers Keep editing / Leave (keep draft) / Discard.
6. **One flow, one modal depth**: the scanner shows at most one sheet
   (manual entry XOR confirm sheet). Dialogs never stack.

## Scan & hand-off paths

- Home *Scan Machine* / Machines *Scan Machine* / machine detail *Scan
  another machine* all push `/(app)/scan`.
- Confirmation “Open this machine” pushes `machines/[id]` — the scanner
  remains beneath, so back returns to a *re-armed* scanner (latch cleared
  on open; camera re-acquired on focus).
- `incidents/create?machineId=` preselects the machine (from machine detail
  or the scan flow); the app bar keeps “Report incident” as the title and
  Back returns to the machine.

## Assistant context

- Tab “Assistant” lists conversations; new conversations explicitly pick a
  machine first, or are opened from a machine (`machines/[id]/assistant`)
  which finds/creates the active conversation for that machine. There is no
  implicit context carry-over between machines; a different machine = a new
  conversation.

## What is deliberately absent

- Drawer/hamburger navigation, bottom-sheet nav menus, deep-link
  authorization shortcuts (QR deep links would bypass the permission
  re-check), and nested tab stacks beyond one level.
