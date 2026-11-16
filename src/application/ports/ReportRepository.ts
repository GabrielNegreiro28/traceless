import type { CaseKey } from '../../domain/case/caseKey';
import type { CaseStatus } from '../../domain/case/caseStatus';
import type { SanitizedText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';

/**
 * What a reporter sends. The ONLY reporter content is `text`, typed SanitizedText: the text
 * the reporter approved (approveReport is its sole creator). RawText and ConsentedRawText are
 * rejected at compile time, so unreviewed text can never reach Firestore by type.
 */
export interface NewReport {
  readonly caseKey: CaseKey;
  readonly text: SanitizedText;
}

/** A case as the follow-up page shows it (read-only). */
export interface CaseRecord {
  readonly caseKey: CaseKey;
  /** The sanitized text as stored; read back for display only, never re-sent. */
  readonly sanitizedText: string;
  readonly status: CaseStatus;
  /** Server time of the report (ms since the epoch). */
  readonly createdAt: number;
}

/** Reports of the organization, keyed by the case key (PLANO §3.5). Never throws. */
export interface ReportRepository {
  /** Creates the report; fails rather than queueing when offline (no offline submit). */
  submit(report: NewReport): Promise<Result<void, AppError>>;
  /** Reads one case by its key; a missing case is `NotFound`. */
  getCase(caseKey: CaseKey): Promise<Result<CaseRecord, AppError>>;
}
