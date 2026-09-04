# QR_SECURITY_MODEL.md

Threat model and protections for machine QR scanning. Scope: the QR payload,
the mobile scanner, and `GET /api/v1/machines/resolve-qr/:qrValue`.

## Core principle

**The QR value is an identifier, never proof of authorization.**
Scanning a label proves the technician is physically near a machine. Only the
backend can decide what the signed-in user may do with that machine. The
mobile app never builds machine context from QR contents alone — it always
round-trips through the resolution endpoint, which re-checks identity,
permissions and organization on every call.

## Protections implemented

| Threat | Protection | Where |
|---|---|---|
| Sensitive data leakage via QR | Payload is exactly `machine:<asset-tag>`; no DB ids, org data, tokens or secrets | `docs/MACHINE_QR_FORMAT.md`; web generator `frontend/src/components/machine-qr-card.tsx` |
| Injection via scanned value | Strict parse: prefix + asset-tag charset/length; rejects URLs/JSON/other schemes before any DB query; parameterized Mongo query | `backend/.../machines.service.ts` `parseMachineQrValue`; mobile `src/lib/qr.ts` pre-validation |
| Machine existence probing / enumeration | Unknown, foreign-org and soft-deleted machines return the **same 404**; per-IP rate limit (60/min) on the endpoint; successful resolutions audited | `machines.service.ts` `resolveQr`; `middleware/rate-limit.ts` `qrResolveRateLimiter`; audit action `machine.qr_resolved` |
| Tampered QR at machine | Resolution re-validates; a forged tag at best yields a 404 or a machine the user is already authorized to see | same as above |
| Cross-tenant access | Organization comes from the live user record (`resolveActorOrg`), never from the request; mismatch → 404 | `machines.service.ts` `resolveQr` |
| Privilege escalation in mobile | Route requires `machine.read`; mobile only mirrors capabilities to hide UI, never to grant them | `machines.routes.ts`; mobile `src/lib/permissions.ts` header |
| QR spoofing opens conversation/incident on wrong machine | Confirmation sheet shows machine identity BEFORE opening; incident form preselects and confirms machine changes; assistant conversation is created server-side against `machineId` | mobile `scan.tsx`, `machine-confirm-sheet.tsx`, `incidents/create.tsx` |
| Camera privacy | QR-only scanning (`barcodeTypes: ['qr']`); no photo/video capture; camera released on blur; permission copy states nothing is recorded | mobile `app.json` permission text; `scan.tsx` |
| Brute force over manual entry | Manual entry uses the same endpoint (same validation, rate limit and audit) | mobile `scan.tsx` `submitManual` → `resolve` |
| Stale authorization after role change | Access token revoked via `token_version` re-check per request (existing platform behaviour) | `middleware/authenticate.ts` |

## Decisions and their trade-offs

- **No signed QR tokens.** Signing would require key distribution to a managed
  Expo Go app (impossible to keep secret) and rotation machinery. Because the
  QR authorizes nothing, a signature buys no security here.
- **Asset tag rather than a dedicated QR secret.** A secret per machine would
  force storage, rotation and reprinting workflows with no compensating
  benefit in a single-plant deployment, and would leak via any list endpoint
  anyway.
- **404-everything for misses.** Revealing "exists but not yours" lets a
  curious user map the fleet. The identical 404 keeps existence private at
  trivial cost: a technician scanning a mislabeled machine gets the same
  message in both cases ("check the register with your supervisor").
- **Rate limit is per-IP, generous (60/min).** Field scanning is a handful of
  scans per shift; enumeration needs thousands. The limiter is in-memory
  (single-node deployment, documented in `rate-limit.ts`).

## What the QR scanner deliberately never does

- Grant access based on the QR value alone.
- Trust a machine name, organization or permission claim encoded in a QR.
- Auto-create incidents, conversations or actions from a scan (a human
  confirms the machine first, then chooses).
- Keep scanning while the screen is not focused, cache resolution results
  across sessions, or retry resolutions automatically.

## Audit

Successful resolutions write `machine.qr_resolved` entries (actor, machine id,
asset tag, request id). Invalid payloads and misses are not audited per
request — they are bounded by the rate limiter and would otherwise let a
broken label spam the append-only log.
