import { describe, expect, it } from 'vitest';
import rules from '../../../firebase/firestore.rules?raw';
import { CASE_KEY_LENGTH } from '../../domain/case/caseKey';
import { CASE_STATUSES, MAX_SUBMITTED_CHARS } from '../../domain/case/caseStatus';
import { REPORT_SCHEMA_VERSION } from './firestoreReportRepository';

/** Keeps firebase/firestore.rules in sync with the app (the emulator tests cover behaviour). */
describe('firestore.rules agrees with the app', () => {
  it('lists exactly the case statuses of the domain', () => {
    const list = /value in \[([^\]]+)\]/.exec(rules)?.[1] ?? '';
    const statuses = list.split(',').map((item) => item.trim().replace(/'/g, ''));
    expect(statuses).toEqual([...CASE_STATUSES]);
  });

  it('caps the text at the same length the app refuses above', () => {
    expect(rules).toContain(`data.sanitizedText.size() <= ${String(MAX_SUBMITTED_CHARS)}`);
  });

  it('accepts only case-key ids and the current schema version', () => {
    expect(rules).toContain(`'^[0-9A-Za-z]{${String(CASE_KEY_LENGTH)}}$'`);
    expect(rules).toContain(`data.schemaVersion == ${String(REPORT_SCHEMA_VERSION)}`);
  });

  it('never allows listing reports to reporters', () => {
    expect(rules).toContain('allow list: if isHandler(orgId);');
  });
});
