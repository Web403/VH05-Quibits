/**
 * Machine QR helpers: payload building, parsing, canonicalisation and error
 * mapping. These pin the same contract the backend enforces
 * (backend/tests/qr-parse.test.ts) - the two suites must stay in agreement.
 */
import {
  buildMachineQrValue,
  canonicalQrValue,
  describeQrResolveError,
  invalidQrMessage,
  parseMachineQrValue,
} from './qr';
import { ApiError } from '@/api/errors';

describe('buildMachineQrValue', () => {
  it('builds the canonical payload, normalising to uppercase', () => {
    expect(buildMachineQrValue('CNC-001')).toBe('machine:CNC-001');
    expect(buildMachineQrValue('  cnc-001 ')).toBe('machine:CNC-001');
  });
});

describe('parseMachineQrValue', () => {
  it('accepts canonical payloads and bare asset tags', () => {
    expect(parseMachineQrValue('machine:CNC-001')).toEqual({ ok: true, assetTag: 'CNC-001' });
    expect(parseMachineQrValue('CNC-001')).toEqual({ ok: true, assetTag: 'CNC-001' });
    expect(parseMachineQrValue('MACHINE:cnc-001')).toEqual({ ok: true, assetTag: 'CNC-001' });
    expect(parseMachineQrValue('  machine: press/line-2 ')).toEqual({ ok: true, assetTag: 'PRESS/LINE-2' });
  });

  it('rejects URLs, JSON, other prefixes and malformed values', () => {
    for (const bad of [
      '',
      '   ',
      'machine:',
      'https://example.com/machine/CNC-001',
      '{"machineId":"123"}',
      'user:bob',
      '-starts-with-dash',
      'a'.repeat(101),
      `machine:${'a'.repeat(51)}`,
      'machine:bad;code',
      'machine:bad code',
      'machine:bad:code',
    ]) {
      expect(parseMachineQrValue(bad).ok).toBe(false);
    }
  });
});

describe('canonicalQrValue', () => {
  it('returns the canonical payload or null', () => {
    expect(canonicalQrValue('cnc-001')).toBe('machine:CNC-001');
    expect(canonicalQrValue('machine:CNC-001')).toBe('machine:CNC-001');
    expect(canonicalQrValue('https://x.example')).toBeNull();
  });
});

describe('invalidQrMessage', () => {
  it('explains links vs broken codes', () => {
    expect(invalidQrMessage('https://example.com/x')).toContain('web link');
    expect(invalidQrMessage('garbage!')).toContain('not a machine code');
  });
});

describe('describeQrResolveError', () => {
  it('maps 400 to "not a machine code" (not retryable)', () => {
    const problem = describeQrResolveError(new ApiError('VALIDATION_ERROR', 'bad', 422));
    expect(problem.title).toBe('Not a machine code');
    expect(problem.retryable).toBe(false);
  });

  it('maps 404 to "unknown machine" without revealing authorization details', () => {
    const problem = describeQrResolveError(new ApiError('NOT_FOUND', 'no machine', 404));
    expect(problem.title).toBe('Unknown machine');
    expect(problem.message).not.toContain('access');
    expect(problem.retryable).toBe(false);
  });

  it('maps 403 to "no access"', () => {
    expect(describeQrResolveError(new ApiError('FORBIDDEN', 'no', 403)).title).toBe('No access');
  });

  it('maps rate limiting and network failures to retryable problems', () => {
    expect(describeQrResolveError(new ApiError('RATE_LIMITED', 'slow', 429)).retryable).toBe(true);
    expect(describeQrResolveError(new ApiError('NETWORK_ERROR', 'down')).retryable).toBe(true);
    expect(describeQrResolveError(new ApiError('TIMEOUT', 'slow')).retryable).toBe(true);
  });

  it('falls back to a generic retryable failure', () => {
    const problem = describeQrResolveError(new Error('boom'));
    expect(problem.retryable).toBe(true);
  });
});
