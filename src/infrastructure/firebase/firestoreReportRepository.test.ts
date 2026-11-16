import type { Firestore } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewReport } from '../../application/ports/ReportRepository';
import type { CaseKey } from '../../domain/case/caseKey';
import { approvedText } from '../../application/usecases/submitReport.testKit';
import { createFirestoreReportRepository } from './firestoreReportRepository';

const sdk = vi.hoisted(() => {
  const serverTime = { kind: 'serverTimestamp' };
  const transaction = { get: vi.fn(), set: vi.fn() };
  return {
    serverTime,
    transaction,
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    getDoc: vi.fn(),
    serverTimestamp: vi.fn(() => serverTime),
    runTransaction: vi.fn(
      async (_db: unknown, update: (t: typeof transaction) => Promise<unknown>) =>
        update(transaction),
    ),
  };
});

vi.mock('firebase/firestore', () => ({
  doc: sdk.doc,
  getDoc: sdk.getDoc,
  serverTimestamp: sdk.serverTimestamp,
  runTransaction: sdk.runTransaction,
}));

const DB = { kind: 'db' } as unknown as Firestore;
const KEY = 'AbCd1234EfGh5678IjKl90' as CaseKey;
const TEXT = approvedText('Invoices were approved twice.');
const REPORT: NewReport = { caseKey: KEY, text: TEXT };
const OPTIONS = { orgId: 'acme-demo', timeoutMs: 50 };

const snapshot = (data: Record<string, unknown> | undefined) => ({
  exists: () => data !== undefined,
  data: () => data,
  get: (field: string) => data?.[field],
});

/** The transaction body runs (the commit starts), then the commit fails with `error`. */
function failAfterCommit(error: unknown): void {
  sdk.runTransaction.mockImplementationOnce(
    async (_db: unknown, update: (t: typeof sdk.transaction) => Promise<unknown>) => {
      await update(sdk.transaction);
      throw error;
    },
  );
}
const firebaseError = (code: string) => Object.assign(new Error(`internal ${code}`), { code });

function repository() {
  return createFirestoreReportRepository(() => DB, OPTIONS);
}

beforeEach(() => {
  sdk.transaction.get.mockResolvedValue(snapshot(undefined));
});

describe('FirestoreReportRepository.submit', () => {
  it('creates orgs/{orgId}/reports/{caseKey} with exactly the allowed fields', async () => {
    await expect(repository().submit(REPORT)).resolves.toEqual({ ok: true, value: undefined });
    expect(sdk.doc).toHaveBeenCalledWith(DB, 'orgs', 'acme-demo', 'reports', KEY);
    expect(sdk.transaction.set).toHaveBeenCalledWith(
      { path: `orgs/acme-demo/reports/${KEY}` },
      { sanitizedText: TEXT, status: 'received', createdAt: sdk.serverTime, schemaVersion: 1 },
    );
  });

  it('runs as a single-attempt transaction (never queued offline)', async () => {
    await repository().submit(REPORT);
    expect(sdk.runTransaction).toHaveBeenCalledWith(DB, expect.any(Function), {
      maxAttempts: 1,
    });
  });

  it('never overwrites an existing, different case', async () => {
    sdk.transaction.get.mockResolvedValue(snapshot({ sanitizedText: 'other' }));
    const result = await repository().submit(REPORT);
    expect(result).toMatchObject({ ok: false, error: { kind: 'Unknown' } });
    expect(sdk.transaction.set).not.toHaveBeenCalled();
  });

  it('is idempotent: the same text already under this key is success, with no write', async () => {
    sdk.transaction.get.mockResolvedValue(snapshot({ sanitizedText: TEXT, status: 'received' }));
    await expect(repository().submit(REPORT)).resolves.toEqual({ ok: true, value: undefined });
    expect(sdk.transaction.set).not.toHaveBeenCalled();
  });

  it.each([
    ['unavailable', 'Offline'],
    ['permission-denied', 'PermissionDenied'],
    ['resource-exhausted', 'QuotaExceeded'],
    ['deadline-exceeded', 'Offline'],
    ['internal', 'Unknown'],
  ])('before the commit, maps %s to the certain failure %s', async (code, kind) => {
    sdk.runTransaction.mockRejectedValueOnce(firebaseError(code));
    const result = await repository().submit(REPORT);
    expect(result).toMatchObject({ ok: false, error: { kind } });
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(JSON.stringify(result)).not.toContain('internal');
  });

  it.each(['unavailable', 'deadline-exceeded', 'aborted', 'cancelled', 'internal', 'unknown'])(
    'after the commit started, %s is an unconfirmed outcome (it may have arrived)',
    async (code) => {
      failAfterCommit(firebaseError(code));
      const result = await repository().submit(REPORT);
      expect(result).toMatchObject({ ok: false, error: { kind: 'SubmitUnconfirmed' } });
    },
  );

  it.each([
    ['permission-denied', 'PermissionDenied'],
    ['resource-exhausted', 'QuotaExceeded'],
  ])('after the commit started, an explicit refusal (%s) stays certain', async (code, kind) => {
    failAfterCommit(firebaseError(code));
    await expect(repository().submit(REPORT)).resolves.toMatchObject({
      ok: false,
      error: { kind },
    });
  });

  it('a send that does not answer in time is unconfirmed, never "offline"', async () => {
    sdk.runTransaction.mockReturnValueOnce(new Promise(() => undefined));
    const result = await repository().submit(REPORT);
    expect(result).toMatchObject({ ok: false, error: { kind: 'SubmitUnconfirmed' } });
  });

  it('does not touch Firestore until the first call', () => {
    const getDb = vi.fn(() => DB);
    createFirestoreReportRepository(getDb, OPTIONS);
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe('FirestoreReportRepository.getCase', () => {
  const stored = {
    sanitizedText: 'Invoices were approved twice.',
    status: 'acknowledged',
    createdAt: { toMillis: () => 1_700_000_000_000 },
    schemaVersion: 1,
  };

  it('reads the case by id', async () => {
    sdk.getDoc.mockResolvedValue(snapshot(stored));
    await expect(repository().getCase(KEY)).resolves.toEqual({
      ok: true,
      value: {
        caseKey: KEY,
        sanitizedText: stored.sanitizedText,
        status: 'acknowledged',
        createdAt: 1_700_000_000_000,
      },
    });
    expect(sdk.doc).toHaveBeenCalledWith(DB, 'orgs', 'acme-demo', 'reports', KEY);
  });

  it('returns NotFound for a missing case', async () => {
    sdk.getDoc.mockResolvedValue(snapshot(undefined));
    await expect(repository().getCase(KEY)).resolves.toMatchObject({
      ok: false,
      error: { kind: 'NotFound' },
    });
  });

  it('refuses a document with an unexpected shape', async () => {
    sdk.getDoc.mockResolvedValue(snapshot({ ...stored, status: 'deleted' }));
    await expect(repository().getCase(KEY)).resolves.toMatchObject({
      ok: false,
      error: { kind: 'Unknown' },
    });
  });

  it('maps an offline read to Offline', async () => {
    sdk.getDoc.mockRejectedValue(firebaseError('unavailable'));
    await expect(repository().getCase(KEY)).resolves.toMatchObject({
      ok: false,
      error: { kind: 'Offline' },
    });
  });
});
