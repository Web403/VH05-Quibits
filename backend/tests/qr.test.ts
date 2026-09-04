/**
 * Machine QR resolution (GET /machines/resolve-qr/:qrValue).
 *
 * Covers the security contract of the QR feature:
 *  - the QR value is an identifier, never authorization (401 without a token,
 *    capability enforced for every role);
 *  - malformed payloads are rejected with a 422 before any database read;
 *  - unknown, soft-deleted and foreign-organization machines are
 *    indistinguishable (the same 404) so existence cannot be probed;
 *  - successful resolutions return only the safe summary and are audited.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  PREFIX,
  auth,
  createAllRoles,
  resetDb,
  setupTestApp,
  teardownTestApp,
  type TestUser,
} from './helpers/app.js';
import { collections } from '../src/database/collections.js';
import { AUDIT_ACTIONS } from '../src/modules/audit/audit.service.js';
import type { UserRole } from '@itp/shared';

let app: Express;
let db: Db;
let users: Record<UserRole, TestUser>;

beforeAll(async () => {
  ({ app, db } = await setupTestApp());
});

afterAll(async () => {
  await teardownTestApp();
});

beforeEach(async () => {
  await resetDb();
  users = await createAllRoles(app, db);
});

async function createMachine(overrides: Record<string, unknown> = {}) {
  const model = await request(app)
    .post(`${PREFIX}/machine-models`)
    .set(...auth(users.admin))
    .send({ manufacturer: 'Haas', modelName: 'VF-2', machineType: 'cnc_mill' });
  const created = await request(app)
    .post(`${PREFIX}/machines`)
    .set(...auth(users.admin))
    .send({ assetTag: 'CNC-001', machineModelId: model.body.data.machineModel.id, ...overrides });
  return created.body.data.machine as { id: string; assetTag: string };
}

const resolve = (value: string, user: TestUser) =>
  request(app)
    .get(`${PREFIX}/machines/resolve-qr/${encodeURIComponent(value)}`)
    .set(...auth(user));

describe('GET /machines/resolve-qr/:qrValue', () => {
  it('resolves a machine by its canonical QR payload', async () => {
    const machine = await createMachine({
      displayName: 'Mill A',
      serialNumber: 'SN-1001',
      location: { site: 'Plant 1', line: 'L2' },
    });

    const res = await resolve('machine:CNC-001', users.technician);
    expect(res.status).toBe(200);
    const summary = res.body.data.machine;
    expect(summary.id).toBe(machine.id);
    expect(summary.name).toBe('Mill A');
    expect(summary.machineCode).toBe('CNC-001');
    expect(summary.serialNumber).toBe('SN-1001');
    expect(summary.machineModelName).toBe('Haas VF-2');
    expect(summary.location).toEqual({ site: 'Plant 1', line: 'L2' });
    expect(summary.status).toBe('operational');
    // The safe summary never carries notes or housekeeping fields.
    expect(summary.notes).toBeUndefined();
    expect(summary.assetTag).toBeUndefined();
    expect(summary.createdAt).toBeUndefined();
  });

  it('resolves bare asset tags case-insensitively (manual entry uses the same flow)', async () => {
    await createMachine();
    for (const value of ['CNC-001', 'cnc-001', 'machine:cnc-001']) {
      const res = await resolve(value, users.viewer);
      expect(res.status).toBe(200);
      expect(res.body.data.machine.machineCode).toBe('CNC-001');
    }
  });

  it('requires authentication', async () => {
    await createMachine();
    const res = await request(app).get(`${PREFIX}/machines/resolve-qr/machine%3ACNC-001`);
    expect(res.status).toBe(401);
  });

  it('allows every authenticated role (machine.read), including viewers', async () => {
    await createMachine();
    for (const role of ['admin', 'manager', 'technician', 'viewer'] as const) {
      const res = await resolve('machine:CNC-001', users[role]);
      expect(res.status).toBe(200);
    }
  });

  it('rejects malformed QR values with a 422', async () => {
    const res = await resolve('https://evil.example/x', users.technician);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns the same safe 404 for unknown machines', async () => {
    const res = await resolve('machine:NOPE-99', users.technician);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('does not resolve soft-deleted machines', async () => {
    const machine = await createMachine();
    await request(app).delete(`${PREFIX}/machines/${machine.id}`).set(...auth(users.admin)).send({});
    const res = await resolve('machine:CNC-001', users.technician);
    expect(res.status).toBe(404);
  });

  it('never reveals machines of another organization', async () => {
    const machine = await createMachine();
    const foreignOrgId = new ObjectId();
    const now = new Date();
    await collections.organizations(db).insertOne({
      _id: foreignOrgId,
      name: 'Other Org',
      slug: 'other',
      is_active: true,
      created_at: now,
      updated_at: now,
      schema_version: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await collections
      .machines(db)
      .updateOne({ _id: new ObjectId(machine.id) }, { $set: { organization_id: foreignOrgId } });

    const res = await resolve('machine:CNC-001', users.admin);
    expect(res.status).toBe(404);
  });

  it('writes an audit entry for successful resolutions only', async () => {
    const machine = await createMachine();
    await resolve('machine:CNC-001', users.technician);
    await resolve('machine:NOPE-99', users.technician);

    const entries = await collections
      .auditLogs(db)
      .find({ action: AUDIT_ACTIONS.machineQrResolved })
      .toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.entity_id?.toHexString()).toBe(machine.id);
    expect(entries[0]?.actor_username).toBe(users.technician.username);
  });
});
