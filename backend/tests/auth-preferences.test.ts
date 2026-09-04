/**
 * Pure unit tests for the public-user preferences projection. `preferences#
 * theme` powers cross-device light/dark/system theming on web and mobile, so
 * the mapping and the malformed-value sanitisation are covered without a DB.
 */
import { describe, expect, it } from 'vitest';
import { ObjectId } from 'mongodb';
import { toPublicUser } from '../src/modules/auth/auth.service.js';
import type { UserDoc } from '../src/database/collections.js';

function baseDoc(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: new ObjectId(),
    username: 'op.rani',
    email: 'rani@acme.local',
    password_hash: 'scrypt$not-a-real-hash',
    tenant_id: new ObjectId(),
    full_name: 'Rani Operator',
    role: 'operator',
    is_active: true,
    must_change_password: false,
    is_deleted: false,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
    token_version: 1,
    refresh_tokens: [],
    failed_login_count: 0,
    locked_until: null,
    last_login_at: null,
    employee_code: null,
    ...overrides,
  } as UserDoc;
}

describe('toPublicUser preferences projection', () => {
  it('maps a full preferences document to camelCase wire shape', () => {
    const user = toPublicUser(baseDoc({ preferences: { locale: 'en-IN', theme: 'dark', timezone: 'Asia/Kolkata' } }));
    expect(user.preferences).toEqual({ locale: 'en-IN', theme: 'dark', timezone: 'Asia/Kolkata' });
  });

  it('returns null when preferences were never set', () => {
    expect(toPublicUser(baseDoc()).preferences).toBeNull();
    expect(toPublicUser(baseDoc({ preferences: null })).preferences).toBeNull();
  });

  it('drops a malformed theme value instead of crashing the client', () => {
    const user = toPublicUser(baseDoc({ preferences: { theme: 'sepia', locale: 'en' } }));
    expect(user.preferences).not.toContain({ theme: 'sepia' });
    expect(user.preferences?.theme).toBeUndefined();
    expect(user.preferences?.locale).toBe('en');
  });

  it('returns null when every preference key was stripped', () => {
    expect(toPublicUser(baseDoc({ preferences: { theme: 'sepia' } })).preferences).toBeNull();
  });
});
