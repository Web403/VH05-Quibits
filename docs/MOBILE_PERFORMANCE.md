# MOBILE_PERFORMANCE.md

Performance decisions for the field app and how to keep them true.

## Rendering & lists

- Lists are `FlatList` (built-in; FlashList is **not** added — its native
  build cost isn't justified at current list sizes; revisit if lists exceed
  a few thousand rows).
- Pagination everywhere (20/page, infinite scroll at 0.4 threshold); only
  page 1 is snapshotted into the offline cache — RAM and SQLite stay small.
- Screens render from React Query cache on revisit (staleTime 10–60 s by
  entity), so back-navigation is instant and refresh is silent.
- Row components are pure; route-level code splitting is implicit via Expo
  Router file routes. No expensive derived state in render paths.
- No decorative animation frameworks; modal fades/slides are platform-native.

## Network discipline

- Debounced search 350 ms (machines, work queue, conversations).
- Home aggregates via five `limit=1` list calls + one `limit=5` (pagination
  metadata as counts) — no dedicated analytics endpoint, nothing polled.
- No polling except: sync status refresh on Profile (5 s only while there
  ARE pending ops), and React Query's reconnect refetch.
- Assistant requests carry the long RAG timeout (130 s) explicitly; normal
  API calls 15 s with one retry on safe reads only.
- QR resolution: `autoRetry: false` (the technician controls re-scans), and
  local pre-validation means malformed codes cost zero network.

## Camera / scanner lifecycle

- `CameraView` mounts only while the scan screen is focused, has camera
  permission, and is not in an error state; `active={phase==='scanning'}`
  stops frame processing during resolution.
- QR-only detection narrows the decoder workload.
- The latch (`resolvingRef`/`lastValueRef`) prevents per-frame resolution
  storms — one barcode = at most one API call.

## Local storage

- expo-sqlite for: outbox ops (pending writes), read-through cache with TTL
  (machines 24 h, incidents 12 h, conversations 1 h), recents (capped at 8),
  form drafts (single kv row, deleted on submit/discard).
- Cache reads happen only on network failure paths, never on the happy path.
- Completed outbox ops are pruned; cache wipe is user-initiated and on logout
  (per-user scoping).

## Bundle & startup

- Expo Go dev workflow; production check is `npm run bundle-check`
  (expo export ≈ 4.7 MB Hermes bytecode, including the scanner).
- `SplashScreen.preventAutoHideAsync` holds splash until session check; DB
  opens synchronously on boot (expo-sqlite sync API).
- Added native modules (`expo-camera`, `expo-haptics`) are Expo-Go-bundled;
  no custom dev client → no additional build time.

## Measurement habits

When changing a list/screen, verify: no refetch-on-render (queryKey
stability), no setState-in-render, debounce intact, skeletons instead of
spinners in lists, and no `console.log` in committed code.
