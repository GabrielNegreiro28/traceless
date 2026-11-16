import { parseCaseKey } from '../../domain/case/caseKey';
import { createAppError, type AppError } from '../../shared/appError';
import { err, type Result } from '../../shared/result';
import type { AuthService } from '../ports/AuthService';
import type { CaseRecord, ReportRepository } from '../ports/ReportRepository';

export interface LookUpCaseDeps {
  readonly auth: AuthService;
  readonly repository: ReportRepository;
  readonly isOnline: () => boolean;
}

/** Fixed messages: never include the key (it alone opens the case). */
const NOT_A_KEY = createAppError('NotFound', { message: 'The input is not a valid case key.' });
const OFFLINE = createAppError('Offline', { message: 'The browser is offline.' });

/**
 * The follow-up page (read-only): parses the key the reporter typed, signs in anonymously
 * (the rules allow `get` by id to signed-in users, never `list`) and reads that one case.
 * A malformed key reads as NotFound, like an unknown one.
 */
export async function lookUpCase(
  input: string,
  deps: LookUpCaseDeps,
): Promise<Result<CaseRecord, AppError>> {
  const caseKey = parseCaseKey(input);
  if (caseKey === null) return err(NOT_A_KEY);
  if (!deps.isOnline()) return err(OFFLINE);
  const signedIn = await deps.auth.ensureSignedIn();
  if (!signedIn.ok) return signedIn;
  return deps.repository.getCase(caseKey);
}
