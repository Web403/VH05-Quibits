# EXPO_GO_SETUP.md

Run the field app in Expo Go against the existing local stack.

## Prerequisites

- Node 20+, the repo's root `npm install` + `npm run build:shared` done
  (the mobile app consumes `@itp/shared` from `packages/`).
- Backend running and reachable (`npm run dev:backend`, or the full
  `npm run dev`); Mongo up (`docker compose up -d mongo`).
- Expo Go on the phone (App Store / Play Store).

## Steps

```bash
# 1. Point the app at the API (LAN IP of this computer, not localhost)
cd apps/mobile
cp .env.example .env      # then edit EXPO_PUBLIC_API_BASE_URL

# 2. Install + start
npm install
npm start                 # or: npm run start:lan (same-Wi-Fi) / start:tunnel

# 3. Open in Expo Go
#    Android: scan the QR from the terminal
#    iOS:     Camera app on the QR, or press "s" and select Expo Go
```

Sign in with a platform account (see "Creating the first administrator" in
the root README). Camera permission is requested the first time you use
**Scan Machine**; it is used for QR codes only.

## Useful commands

| Command | Purpose |
|---|---|
| `npm start` / `npm run start:lan` | Dev server for Expo Go on the LAN |
| `npm run start:tunnel` | Dev server through a tunnel (restricted networks) |
| `npm test` | Jest suite (no device needed) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run bundle-check` | `expo export` — verifies the bundle compiles as Expo Go will consume it |

## Troubleshooting

- **Login spins / "Cannot reach the API"** → the URL is likely `localhost`:
  see `docs/MOBILE_ENVIRONMENT.md`. The login screen warns about loopback
  URLs for this reason.
- **Expo Go shows the app but camera does nothing** → grant the camera
  permission; on iOS, Expo Go must itself be allowed camera access in
  Settings.
- **Stale config after editing `.env`** → restart `expo start` (variables
  are inlined at start time).
- **Backend is up but phone can't see it** → backend must bind `0.0.0.0`
  (the repo's dev script does) and the firewall must allow the port.
