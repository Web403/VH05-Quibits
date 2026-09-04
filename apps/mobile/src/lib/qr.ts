/**
 * Machine QR values (client side).
 *
 * The canonical payload printed on machine labels is `machine:<asset-tag>`.
 * The asset tag is the immutable shop-floor identifier - no database ids, no
 * organization data, no secrets. Scanning proves presence at the machine,
 * NOT authorization: every resolution goes through
 * GET /machines/resolve-qr/:qrValue and the backend is the final authority.
 *
 * These helpers only pre-validate locally so obviously-broken scans give
 * immediate feedback without a network round-trip. They mirror
 * backend/src/modules/machines/machines.service.ts (parseMachineQrValue) and
 * must not drift from it; qr.test.ts pins the shared contract.
 */

export const MACHINE_QR_PREFIX = 'machine:';

/** Asset tags: letters/digits/dot/dash/underscore/slash, 1-50 chars. */
const ASSET_TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,49}$/;

export type QrParseResult = { ok: true; assetTag: string } | { ok: false };

/** Build the canonical QR payload for a machine (used by docs and tests). */
export function buildMachineQrValue(assetTag: string): string {
  return `${MACHINE_QR_PREFIX}${assetTag.trim().toUpperCase()}`;
}

/**
 * Parse a scanned (or manually typed) machine code.
 *
 * Accepted: `machine:<asset-tag>` and bare asset tags (manual entry resolves
 * through the same backend flow). Rejected: URLs, JSON, other prefixes,
 * control characters - whatever they encode, they are not machine references.
 */
export function parseMachineQrValue(raw: string): QrParseResult {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 100) return { ok: false };
  const candidate = trimmed.toLowerCase().startsWith(MACHINE_QR_PREFIX)
    ? trimmed.slice(MACHINE_QR_PREFIX.length)
    : trimmed;
  const assetTag = candidate.trim().toUpperCase();
  if (!ASSET_TAG_PATTERN.test(assetTag)) return { ok: false };
  return { ok: true, assetTag };
}

/** The value sent to the resolution endpoint (canonical `machine:<tag>`). */
export function canonicalQrValue(raw: string): string | null {
  const parsed = parseMachineQrValue(raw);
  return parsed.ok ? buildMachineQrValue(parsed.assetTag) : null;
}

/** How a failed resolution is presented on the scanner screen. */
export interface QrResolveProblem {
  title: string;
  message: string;
  /** True when the technician can retry the same scan/code. */
  retryable: boolean;
}

/**
 * Map a resolveMachineQr failure to copy the technician can act on.
 *
 * 404 already means "unknown OR not visible to you" server-side; the message
 * deliberately does not distinguish them either. Network problems are the
 * only retryable class; everything else needs a different code or a
 * supervisor, not a hammered retry.
 */
export function describeQrResolveError(error: unknown): QrResolveProblem {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? (error as { status?: number }).status
    : undefined;
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: string }).code)
    : '';

  if (status === 400 || status === 422 || code === 'VALIDATION_ERROR') {
    return {
      title: 'Not a machine code',
      message: 'This QR code is not a machine code. Scan the code on the machine label (it starts with "machine:").',
      retryable: false,
    };
  }
  if (status === 404) {
    return {
      title: 'Unknown machine',
      message: 'No machine matches this code. If the label looks right, ask your supervisor to check the machine register.',
      retryable: false,
    };
  }
  if (status === 403) {
    return {
      title: 'No access',
      message: 'Your account cannot open machines. Ask your administrator for access.',
      retryable: false,
    };
  }
  if (status === 429 || code === 'RATE_LIMITED') {
    return {
      title: 'Too many scans',
      message: 'Scanning is rate-limited. Wait a moment, then try again.',
      retryable: true,
    };
  }
  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT' || code === 'ABORTED') {
    return {
      title: 'No connection',
      message: 'Cannot reach the server. Scanning needs a connection - move to coverage or try again shortly.',
      retryable: true,
    };
  }
  return {
    title: 'Scan failed',
    message: 'The machine could not be loaded. Try scanning again.',
    retryable: true,
  };
}

/** User-facing explanation for a rejected scan, shown inline (no alert). */
export function invalidQrMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'That code was empty.';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return 'That QR code contains a web link, not a machine code.';
  }
  return 'That QR code is not a machine code. Machine QR codes are printed on the machine label and start with "machine:".';
}
