import { InferenceSource } from 'firebase/ai';
import { parseStructuredReport } from '../../../ai/schemas/structureReport';
import type { InferenceSourceKind } from '../../../application/ports/IdentityScanner';
import type {
  ReportStructurer,
  StructureOutcome,
} from '../../../application/ports/ReportStructurer';
import type { SanitizedText } from '../../../domain/text/brandedText';
import { createAppError, type AppError } from '../../../shared/appError';
import { err, ok, type Result } from '../../../shared/result';
import { mapCloudAiError } from '../cloudErrorMapper';
import { withDeadline } from '../deadline';

/** The slice of HybridModel the structurer uses. */
export interface StructurableModel {
  generateContent(text: SanitizedText): Promise<{
    readonly response: { readonly inferenceSource?: InferenceSource; text(): string };
  }>;
}

const TIMED_OUT = createAppError('Offline', { message: 'Organizing the report timed out.' });

/** Maps, never casts: anything but the SDK's ON_DEVICE value counts as the cloud. */
function sourceOf(inferenceSource: InferenceSource | undefined): InferenceSourceKind {
  return inferenceSource === InferenceSource.ON_DEVICE ? 'ON_DEVICE' : 'IN_CLOUD';
}

/**
 * ReportStructurer on the hybrid model (PREFER_ON_DEVICE): one call, zod-validated output,
 * and where it really ran from `response.inferenceSource`. The model is created on first use
 * and reused. `timeoutMs` bounds the on-device path too (the cloud has its own timeout).
 * Never rejects: every failure, including a safety block raised by `text()`, is an AppError.
 */
export class HybridReportStructurer implements ReportStructurer {
  private model: StructurableModel | null = null;
  private readonly getModel: () => Result<StructurableModel, AppError>;
  private readonly timeoutMs: number;

  constructor(getModel: () => Result<StructurableModel, AppError>, timeoutMs: number) {
    this.getModel = getModel;
    this.timeoutMs = timeoutMs;
  }

  structure(text: SanitizedText): Promise<Result<StructureOutcome, AppError>> {
    return withDeadline(this.run(text), this.timeoutMs, () => err(TIMED_OUT));
  }

  private async run(text: SanitizedText): Promise<Result<StructureOutcome, AppError>> {
    try {
      if (this.model === null) {
        const created = this.getModel();
        if (!created.ok) return created;
        this.model = created.value;
      }
      const { response } = await this.model.generateContent(text);
      const parsed = parseStructuredReport(response.text());
      if (!parsed.ok) return parsed;
      return ok({ report: parsed.value, source: sourceOf(response.inferenceSource) });
    } catch (error) {
      return err(mapCloudAiError(error));
    }
  }
}
