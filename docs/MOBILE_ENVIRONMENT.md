# MOBILE_ENVIRONMENT.md

Environment configuration for the mobile app (`apps/mobile/.env`, copied
from `apps/mobile/.env.example`).

`EXPO_PUBLIC_*` variables are inlined into the JS bundle by the Expo CLI at
start time — **restart `expo start` after every change**. They are never
secrets: everything here ships to the device.

| Variable | Default | Meaning |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:8080/api/v1` | Express API base URL the app talks to. Accepts a bare origin (`http://192.168.1.50:8080`) or one already carrying the `/api/v1` prefix. |
| `EXPO_PUBLIC_API_TIMEOUT_MS` | `15000` | Normal request timeout. |
| `EXPO_PUBLIC_RAG_TIMEOUT_MS` | `130000` | Timeout for assistant answers (RAG can take ~2 minutes). |

## The localhost trap

`localhost` **on the phone is the phone itself.** On a physical device set
the variable to your development machine's LAN IP, e.g.:

```bash
# macOS/Linux
EXPO_PUBLIC_API_BASE_URL=http://$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}'):8080/api/v1
```

The login screen shows a warning when the configured URL is a loopback
address and the app is unlikely to reach the API. Phone and computer must be
on the same network, and the backend must listen on `0.0.0.0` (the
`npm run dev:backend` script does).

## What is intentionally NOT here

- No tokens, API keys, or secrets (the app authenticates with
  email/password and stores the session in the device keystore).
- No environment for the AI service, Qdrant or Mongo — the mobile app only
  ever calls the Express API, exactly like the web frontend.
