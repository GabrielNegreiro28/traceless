import { doc, getDoc, type DocumentReference, type Firestore } from 'firebase/firestore';
import { z } from 'zod';
import type { CaseRecord, ReportRepository } from '../../application/ports/ReportRepository';
import type { CaseKey } from '../../domain/case/caseKey';
import { CASE_STATUSES } from '../../domain/case/caseStatus';
import { createAppError, type AppError } from '../../shared/appError';
import { logger } from '../../shared/logger';
import { err, ok, type Result } from '../../shared/result';
import { withDeadline } from '../ai/deadline';
import { mapFirebaseError } from './firebaseErrorMapper';
import { REPORT_SCHEMA_VERSION, submitInTransaction } from './reportSubmit';

export { REPORT_SCHEMA_VERSION } from './reportSubmit';

export interface FirestoreReportRepositoryOptions {
  /** The organization that receives reports (the demo org, `acme-demo`). */
  readonly orgId: string;
  /** Upper bound for one call; past it a read fails as Offline, a send as SubmitUnconfirmed. */
  readonly timeoutMs: number;
}

const TIMED_OUT = createAppError('Offline', { message: 'Firestore did not answer in time.' });
const BAD_DOCUMENT = createAppError('Unknown', {
  message: 'The stored case does not have the expected shape.',
});
const NOT_FOUND = createAppError('NotFound', { message: 'No case with this key.' });

const CASE_DOCUMENT = z.object({
  sanitizedText: z.string(),
  status: z.enum(CASE_STATUSES),
  createdAt: z.custom<{ toMillis: () => number }>(
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { toMillis?: unknown }).toMillis === 'function',
  ),
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
});

function reportRef(db: Firestore, orgId: string, caseKey: CaseKey): DocumentReference {
  return doc(db, 'orgs', orgId, 'reports', caseKey);
}

/**
 * ReportRepository over Firestore: `orgs/{orgId}/reports/{caseKey}`.
 *
 * The submit is a single-attempt transaction (reportSubmit.ts): never queued offline, never
 * overwriting, idempotent for the same text, and an unknown outcome is reported as
 * SubmitUnconfirmed, never as "not sent". `getDb` is called on first use only.
 */
export function createFirestoreReportRepository(
  getDb: () => Firestore,
  options: FirestoreReportRepositoryOptions,
): ReportRepository {
  const { orgId, timeoutMs } = options;
  /** Maps throws to AppError and logs the kind; `deadline` false when `work` has its own. */
  const guarded = async <T>(
    event: string,
    work: () => Promise<Result<T, AppError>>,
    deadline = true,
  ): Promise<Result<T, AppError>> => {
    try {
      const pending = work();
      const result = deadline
        ? await withDeadline(pending, timeoutMs, () => err(TIMED_OUT))
        : await pending;
      if (!result.ok) logger.warn(event, { kind: result.error.kind });
      return result;
    } catch (error) {
      const mapped = mapFirebaseError(error);
      logger.warn(event, { kind: mapped.kind });
      return err(mapped);
    }
  };

  return {
    submit: (report) =>
      guarded(
        'Report submit failed',
        async () => {
          const db = getDb();
          return submitInTransaction(db, reportRef(db, orgId, report.caseKey), report, timeoutMs);
        },
        false,
      ),
    getCase: (caseKey) =>
      guarded('Case lookup failed', async (): Promise<Result<CaseRecord, AppError>> => {
        const snapshot = await getDoc(reportRef(getDb(), orgId, caseKey));
        if (!snapshot.exists()) return err(NOT_FOUND);
        const parsed = CASE_DOCUMENT.safeParse(snapshot.data());
        if (!parsed.success) return err(BAD_DOCUMENT);
        const { sanitizedText, status, createdAt } = parsed.data;
        return ok({ caseKey, sanitizedText, status, createdAt: createdAt.toMillis() });
      }),
  };
}
