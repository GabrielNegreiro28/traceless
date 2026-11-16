import { createAppError, type AppError } from '../../shared/appError';

/**
 * Maps Firestore and Auth exceptions to AppError (CLAUDE.md rule 5). Messages are FIXED
 * strings and the error is never attached as `cause`: an SDK message could echo a document
 * path, and the document id is the case key, which alone opens the case.
 */

const OFFLINE = createAppError('Offline', { message: 'Firebase could not be reached.' });
const DENIED = createAppError('PermissionDenied', {
  message: 'Firebase refused the request (security rules or App Check).',
});
const NOT_FOUND = createAppError('NotFound', { message: 'The document does not exist.' });
const QUOTA = createAppError('QuotaExceeded', { message: 'A Firebase usage limit was reached.' });
const ANONYMOUS_DISABLED = createAppError('Misconfigured', {
  message: 'Anonymous sign-in is not enabled for this Firebase project.',
  missing: ['Firebase Authentication: anonymous provider'],
});
const UNKNOWN = createAppError('Unknown', { message: 'Unexpected Firebase error.' });

const BY_CODE: Readonly<Record<string, AppError>> = {
  unavailable: OFFLINE,
  'deadline-exceeded': OFFLINE,
  'permission-denied': DENIED,
  unauthenticated: DENIED,
  'not-found': NOT_FOUND,
  'resource-exhausted': QUOTA,
  'auth/network-request-failed': OFFLINE,
  'auth/operation-not-allowed': ANONYMOUS_DISABLED,
  'auth/admin-restricted-operation': ANONYMOUS_DISABLED,
  'auth/too-many-requests': QUOTA,
  'auth/firebase-app-check-token-is-invalid': DENIED,
};

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

export function mapFirebaseError(error: unknown): AppError {
  const code = codeOf(error);
  return (code === undefined ? undefined : BY_CODE[code]) ?? UNKNOWN;
}
