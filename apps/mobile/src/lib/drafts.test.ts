/**
 * Incident draft persistence (kv store, in-memory sqlite via the test mocks).
 */
import { clearIncidentDraft, draftHasContent, loadIncidentDraft, saveIncidentDraft } from './drafts';
import { initDatabase } from '@/db/database';
import * as SQLite from 'expo-sqlite';

const { __resetAll } = SQLite as unknown as { __resetAll: () => void };

beforeEach(() => {
  __resetAll();
  initDatabase();
});

describe('incident drafts', () => {
  it('saves, loads and clears a draft scoped to the user', () => {
    expect(loadIncidentDraft('u1')).toBeNull();
    saveIncidentDraft('u1', {
      machineId: 'm1',
      machineLabel: 'Mill A',
      title: 'Grinding noise',
      description: 'Noise from spindle at high RPM',
      severity: 'high',
      priority: 'urgent',
      symptoms: ['vibration'],
      errorCodes: ['E-104'],
      operatingConditions: [],
      tags: [],
    });

    const draft = loadIncidentDraft('u1');
    expect(draft?.title).toBe('Grinding noise');
    expect(draft?.machineLabel).toBe('Mill A');
    expect(typeof draft?.savedAt).toBe('string');
    // Another user sees nothing.
    expect(loadIncidentDraft('u2')).toBeNull();

    clearIncidentDraft('u1');
    expect(loadIncidentDraft('u1')).toBeNull();
  });

  it('recognizes contentless drafts as not worth restoring', () => {
    expect(
      draftHasContent({
        machineId: null,
        machineLabel: null,
        title: '',
        description: '',
        severity: 'medium',
        priority: 'medium',
        symptoms: [],
        errorCodes: [],
        operatingConditions: [],
        tags: [],
        savedAt: new Date().toISOString(),
      }),
    ).toBe(false);
    expect(draftHasContent(null)).toBe(false);
  });
});
