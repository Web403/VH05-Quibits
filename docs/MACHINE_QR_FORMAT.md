# MACHINE_QR_FORMAT.md

Canonical definition of the QR payload printed on machine labels and scanned
by the mobile app. One format, three consumers (web label generator, mobile
scanner, backend resolver) — this document is their shared contract.

## Payload

```text
machine:<ASSET-TAG>
```

Example: `machine:CNC-001`

- The **asset tag** (`asset_tag` in `machines`) is the identifier. It is:
  - **Immutable** — the backend rejects any attempt to change it; a printed
    label can never go stale.
  - **Unique** — case-insensitive unique index (`uniq_asset_tag`).
  - **Shop-floor known** — it is already the human reference for the asset.
- Normalisation: asset tags are stored uppercase. Scanners SHOULD normalise
  case before resolving; the resolver matches case-insensitively regardless.

## Accepted input forms (resolution input, not print output)

| Form | Example | Notes |
|---|---|---|
| `machine:<asset-tag>` | `machine:CNC-001` | The canonical, preferred form — the only one the web prints. |
| Bare asset tag | `CNC-001` | Damaged labels and manual machine-code entry use the same flow. |
| Case variations | `MACHINE:cnc-001` | Prefix and tag are case-insensitive. |

Everything else is rejected with a 422 before any database read: URLs, JSON,
other prefixes (`user:`, `org:`…), payloads over 100 characters, asset tags
over 50 characters, and values outside the asset-tag character set
(`A–Z 0–9 . - _ /`, first character alphanumeric).

## Explicitly NOT in the QR

- MongoDB `_id` / any database primary key
- Organization id, slug or name
- User names, tokens, passwords, session data
- Incident or maintenance data
- URLs that skip authorization (no deep-link authorization exists)
- Signed/encrypted blobs (no secret material any client must keep)

The QR code is an **identifier, not proof of authorization**. Tampering with
it produces, at worst, a reference to a different machine, which the backend
then authorizes normally.

## Who generates QR codes

The web application (machine detail → *Machine QR code*) renders the code
client-side with `qrcode.react` and offers PNG download + print. There is no
server-side QR asset, and there is **no rotation**: the payload derives from
an immutable field. If an asset tag were ever retired, the old QR simply
resolves to a 404 (soft-deleted machines do not resolve).

## Error model at resolution

| Situation | Response | Rationale |
|---|---|---|
| Malformed payload | `422 VALIDATION_ERROR` | Explicit, immediate |
| Unknown machine, foreign organization, soft-deleted | `404 NOT_FOUND` (identical body) | Probing must not reveal existence |
| No `machine.read` capability | `403 FORBIDDEN` | RBAC, unchanged |
| No token | `401 UNAUTHENTICATED` | Standard |
| Abuse pattern | `429 RATE_LIMITED` | 60/min per IP |

See `docs/QR_SECURITY_MODEL.md` for the full security analysis and
`docs/MOBILE_QR_SCANNING.md` for the scanning UX.
