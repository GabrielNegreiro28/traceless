import type { StructuredReport } from '../../domain/report/structuredReport';
import type { SanitizedText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';
import type { InferenceSourceKind } from './IdentityScanner';

/** One organized report and where the model really ran (the SDK's `inferenceSource`). */
export interface StructureOutcome {
  readonly report: StructuredReport;
  readonly source: InferenceSourceKind;
}

/**
 * Organizes APPROVED text into category, summary, when and where (the `structureReport`
 * task: SANITIZED data, PREFER_ON_DEVICE). Accepts SanitizedText only, so neither RawText nor
 * ConsentedRawText can reach this hybrid (cloud-capable) model by type. Never throws.
 */
export interface ReportStructurer {
  structure(text: SanitizedText): Promise<Result<StructureOutcome, AppError>>;
}
