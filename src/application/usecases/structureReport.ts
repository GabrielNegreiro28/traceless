import { keepGroundedDetails } from '../../domain/report/structuredReport';
import type { SanitizedText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import type { ReportStructurer, StructureOutcome } from '../ports/ReportStructurer';

export interface StructureReportDeps {
  readonly structurer: ReportStructurer;
}

const CRASHED = createAppError('Unknown', { message: 'Organizing the report threw.' });

/**
 * Organizes the approved report for the organization (optional: a failure never blocks
 * sending). Accepts only SanitizedText. `when`/`where` values that are not quoted from the
 * approved text are dropped, so the model cannot add details the reporter did not approve.
 */
export async function structureReport(
  text: SanitizedText,
  deps: StructureReportDeps,
): Promise<Result<StructureOutcome, AppError>> {
  let result: Result<StructureOutcome, AppError>;
  try {
    result = await deps.structurer.structure(text);
  } catch {
    return err(CRASHED);
  }
  if (!result.ok) return result;
  return ok({ ...result.value, report: keepGroundedDetails(result.value.report, text) });
}
