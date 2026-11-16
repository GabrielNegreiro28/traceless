import {
  runTransaction,
  serverTimestamp,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore';
import type { NewReport } from '../../application/ports/ReportRepository';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import { withDeadline } from '../ai/deadline';
import { mapFirebaseError } from './firebaseErrorMapper';

/** Version of the report document shape (PLANO §3.5); the rules require exactly this. */
export const REPORT_SCHEMA_VERSION = 1;

/**
 * The send may have reached the server: a timeout (the transaction is not cancelled and may
 * still commit) or a failure after the commit started. Never reported as "not sent".
 */
export const UNCONFIRMED = createAppError('SubmitUnconfirmed', {
  message: 'The report write could not be confirmed; it may have been committed.',
});
const KEY_TAKEN = createAppError('Unknown', {
  message: 'A different case with this key already exists.',
});

/** Codes that prove the commit was refused, even when it failed during the commit. */
const REFUSED_COMMIT_CODES: readonly string[] = [
  'permission-denied',
  'unauthenticated',
  'resource-exhausted',
  'invalid-argument',
];

/** Thrown inside the transaction when the id holds a different report; aborts, no write. */
class CaseKeyTaken extends Error {}

/** Exactly the keys the rules allow; reporter content is only the sanitized text. */
function newReportData(report: NewReport) {
  return {
    sanitizedText: report.text,
    status: 'received',
    createdAt: serverTimestamp(),
    schemaVersion: REPORT_SCHEMA_VERSION,
  } as const;
}

function codeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Certain vs unknown outcome. Before the commit (the read failed, for example offline) the
 * report surely did not arrive; after it started, only an explicit refusal is certain.
 */
export function classifySubmitError(error: unknown, commitStarted: boolean): AppError {
  if (error instanceof CaseKeyTaken) return KEY_TAKEN;
  if (!commitStarted) return mapFirebaseError(error);
  const code = codeOf(error);
  return code !== undefined && REFUSED_COMMIT_CODES.includes(code)
    ? mapFirebaseError(error)
    : UNCONFIRMED;
}

/**
 * Creates the report in a single-attempt transaction. Unlike `setDoc`, a transaction is never
 * queued offline (Firestore fails it), and it never overwrites an existing id. Idempotent:
 * an existing document with the same sanitized text is this report, sent by an earlier
 * attempt whose answer was lost, so it counts as success under the same key.
 */
export async function submitInTransaction(
  db: Firestore,
  ref: DocumentReference,
  report: NewReport,
  timeoutMs: number,
): Promise<Result<void, AppError>> {
  let commitStarted = false;
  const work = runTransaction(
    db,
    async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists()) {
        if (existing.get('sanitizedText') !== report.text) throw new CaseKeyTaken();
        return;
      }
      transaction.set(ref, newReportData(report));
      commitStarted = true;
    },
    { maxAttempts: 1 },
  ).then(
    (): Result<void, AppError> => ok(undefined),
    (error: unknown): Result<void, AppError> => err(classifySubmitError(error, commitStarted)),
  );
  return withDeadline(work, timeoutMs, () => err(UNCONFIRMED));
}
