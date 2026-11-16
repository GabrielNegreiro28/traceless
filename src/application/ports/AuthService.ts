import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';

/**
 * Anonymous identity for the Firestore rules (PLANO §3.5). Called only when the reporter sends
 * a report or looks up a case, never on page load, so composing and reviewing need no account
 * and no network. The identity lives in memory only (ADR 0005).
 */
export interface AuthService {
  /** Signs in anonymously, or reuses this tab's anonymous user. Never throws. */
  ensureSignedIn(): Promise<Result<void, AppError>>;
}
