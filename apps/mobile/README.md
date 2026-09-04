# ITP Field (mobile)

Field companion app for the industrial troubleshooting platform
(React Native + **Expo Go**, Expo SDK 57, Expo Router file-based routing).
It consumes the existing Express API only — there is no second backend.

## Quick start

```bash
npm install
cp .env.example .env      # set EXPO_PUBLIC_API_BASE_URL to your LAN IP:8080/api/v1
npm start                 # then scan the QR with Expo Go
```

Full instructions: [`docs/EXPO_GO_SETUP.md`](../../docs/EXPO_GO_SETUP.md) and
[`docs/MOBILE_ENVIRONMENT.md`](../../docs/MOBILE_ENVIRONMENT.md).

## What it does

- Sign in (same accounts as the web app), session kept in the device keystore.
- **Scan machine QR codes** to open the right machine in seconds
  (`machine:<asset-tag>`, see [`docs/MACHINE_QR_FORMAT.md`](../../docs/MACHINE_QR_FORMAT.md)).
- Work queue, machine/incident/manual browsing, troubleshooting assistant
  with citations, technician actions, root-cause/fix confirmations.
- Offline-capable writes through a local outbox (SQLite) — nothing is marked
  server-confirmed until the server actually confirms it.

## Commands

| Command | Purpose |
|---|---|
| `npm start` / `start:lan` / `start:tunnel` | Expo dev server for Expo Go |
| `npm test` | Jest suite (camera, router, sqlite all mocked — no device) |
| `npm run typecheck` | TypeScript |
| `npm run bundle-check` | Production bundle check via `expo export` |

## Documentation

Design system, navigation, accessibility, performance, field usability and
QR scanning guides live in [`docs/`](../../docs/PHASE_QR_UI_IMPLEMENTATION.md).
