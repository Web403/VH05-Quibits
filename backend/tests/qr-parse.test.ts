/**
 * Pure unit tests for machine QR payload parsing (no database required).
 *
 * The HTTP-level behaviour of GET /machines/resolve-qr/:qrValue lives in
 * qr.test.ts (integration, needs mongod). These exercise the acceptance and
 * rejection rules that stand between a tampered scan and the database.
 */
import { describe, it, expect } from 'vitest';
import { parseMachineQrValue } from '../src/modules/machines/machines.service.js';

describe('parseMachineQrValue', () => {
  it('accepts the canonical payload and bare asset tags', () => {
    expect(parseMachineQrValue('machine:CNC-001')).toEqual({ ok: true, assetTag: 'CNC-001' });
    expect(parseMachineQrValue('CNC-001')).toEqual({ ok: true, assetTag: 'CNC-001' });
    // Prefix matching is case-insensitive; tags normalise to uppercase,
    // exactly like assetTagSchema at machine-creation time.
    expect(parseMachineQrValue('MACHINE:cnc-001')).toEqual({ ok: true, assetTag: 'CNC-001' });
    expect(parseMachineQrValue('  machine: press/line-2  ')).toEqual({
      ok: true,
      assetTag: 'PRESS/LINE-2',
    });
  });

  it('accepts the full asset-tag character set (letters, digits, dot, dash, underscore, slash)', () => {
    expect(parseMachineQrValue('machine:A1-B_2.C/3')).toEqual({ ok: true, assetTag: 'A1-B_2.C/3' });
    expect(parseMachineQrValue('7')).toEqual({ ok: true, assetTag: '7' });
    expect(parseMachineQrValue(`machine:${'X'.repeat(50)}`)).toEqual({
      ok: true,
      assetTag: 'X'.repeat(50),
    });
    // Tag-shaped strings (even ones that look like URL paths) are accepted and
    // simply resolve to no machine (404) - the safe failure direction.
    expect(parseMachineQrValue('app.example.com/machine/CNC-001').ok).toBe(true);
  });

  it('rejects anything that is not a machine reference', () => {
    for (const bad of [
      '',
      '   ',
      'machine:',
      'machine:  ',
      'https://example.com/machine/CNC-001',
      '{"machineId":"123"}',
      'user:bob',
      'org:default/machine:x',
      '-starts-with-dash',
      '.starts-with-dot',
      'a'.repeat(101),
      `machine:${'a'.repeat(51)}`,
      'machine:bad;code',
      'machine:bad code',
      'machine:bad$code',
      'machine:bad:code',
    ]) {
      expect(parseMachineQrValue(bad).ok).toBe(false);
    }
  });
});
