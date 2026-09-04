/**
 * Local form drafts.
 *
 * A draft is a convenience, never a record: it lives in the user-scoped kv
 * store, is clearly labeled when recovered, and is deleted the moment the
 * form is submitted or explicitly discarded. Only the create-incident form
 * uses drafts today - it is the one form long enough that an interrupted
 * technician loses real work.
 */
import { kvDelete, kvGet, kvSet } from '@/db/database';

export interface IncidentDraft {
  machineId: string | null;
  /** Display snapshot so the recovered draft can show the machine offline. */
  machineLabel: string | null;
  title: string;
  description: string;
  severity: string;
  priority: string;
  symptoms: string[];
  errorCodes: string[];
  operatingConditions: string[];
  tags: string[];
  savedAt: string;
}

const KEY = 'draft.create_incident';

export function saveIncidentDraft(userId: string, draft: Omit<IncidentDraft, 'savedAt'>): void {
  kvSet(userId, KEY, { ...draft, savedAt: new Date().toISOString() });
}

export function loadIncidentDraft(userId: string): IncidentDraft | null {
  return kvGet<IncidentDraft>(userId, KEY);
}

export function clearIncidentDraft(userId: string): void {
  kvDelete(userId, KEY);
}

/** True when a draft has any content worth offering to restore. */
export function draftHasContent(draft: IncidentDraft | null): boolean {
  if (!draft) return false;
  return (
    Boolean(draft.title.trim()) ||
    Boolean(draft.description.trim()) ||
    draft.symptoms.length > 0 ||
    draft.errorCodes.length > 0 ||
    draft.tags.length > 0 ||
    Boolean(draft.machineId)
  );
}
