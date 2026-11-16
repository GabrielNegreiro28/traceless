import type { CaseKey } from '../../domain/case/caseKey';
import { MAX_SUBMITTED_CHARS } from '../../domain/case/caseStatus';
import type { SanitizedText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import type { AuthService } from '../ports/AuthService';
import type { ReportRepository } from '../ports/ReportRepository';

export interface SubmitReportDeps {
  readonly auth: AuthService;
  readonly repository: ReportRepository;
  /** The browser's connectivity hint (navigator.onLine). */
  readonly isOnline: () => boolean;
}

export interface SubmittedReport {
  /** Shown to the reporter once; never stored by the app (ADR 0003, ADR 0005). */
  readonly caseKey: CaseKey;
}

/** Fixed messages: never include report text. */
const OFFLINE = createAppError('Offline', {
  message: 'The browser is offline; the report was not sent and stays in this tab.',
});
const TOO_LONG = createAppError('InputTooLong', {
  message: `The approved report is longer than ${String(MAX_SUBMITTED_CHARS)} characters.`,
});

/**
 * Sends the approved report to the organization (PLANO §3.5, Fase 4). Accepts only
 * SanitizedText. Offline it fails at once ("Reconnect to send"): there is no queued offline
 * submit (DECISIONS 2026-11-13). Signs in anonymously only now, then creates the report under
 * `caseKey` (issued by generateCaseKey with a CSPRNG), which is returned for the reporter to
 * save. Idempotent: retrying the same text with the same key after an unconfirmed send
 * succeeds if the first attempt arrived, instead of creating a second case.
 */
export async function submitReport(
  text: SanitizedText,
  caseKey: CaseKey,
  deps: SubmitReportDeps,
): Promise<Result<SubmittedReport, AppError>> {
  if (!deps.isOnline()) return err(OFFLINE);
  if (text.length > MAX_SUBMITTED_CHARS) return err(TOO_LONG);
  const signedIn = await deps.auth.ensureSignedIn();
  if (!signedIn.ok) return signedIn;
  const saved = await deps.repository.submit({ caseKey, text });
  if (!saved.ok) return saved;
  return ok({ caseKey });
}
