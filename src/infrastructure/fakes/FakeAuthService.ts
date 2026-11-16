import type { AuthService } from '../../application/ports/AuthService';
import type { AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';

/** Deterministic AuthService for tests and demo mode: no Firebase, no network. */
export class FakeAuthService implements AuthService {
  signIns = 0;
  private failure: AppError | null = null;

  /** Makes every later sign-in fail with `error` (null restores success). */
  failWith(error: AppError | null): void {
    this.failure = error;
  }

  ensureSignedIn(): Promise<Result<void, AppError>> {
    this.signIns += 1;
    return Promise.resolve(this.failure === null ? ok(undefined) : err(this.failure));
  }
}
