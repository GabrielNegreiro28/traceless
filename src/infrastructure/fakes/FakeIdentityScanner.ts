import type {
  IdentityScanner,
  IdentityScanResult,
  InferenceSourceKind,
} from '../../application/ports/IdentityScanner';
import type { ModelFinding } from '../../domain/detection/types';
import type { RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';

/** What the fake answers for one call. */
export type FakeScanStep =
  | {
      readonly findings: readonly ModelFinding[];
      /** Quotes labelled as people not to flag (default: none). */
      readonly protectedQuotes?: readonly string[];
      readonly source?: InferenceSourceKind;
      readonly retries?: number;
    }
  | { readonly error: AppError };

export interface FakeIdentityScannerOptions {
  /** Answers for calls 0, 1, 2… in order; once exhausted, `respond` is used. */
  readonly steps?: readonly FakeScanStep[];
  /** Fallback answer per call (default: no findings). */
  readonly respond?: (chunk: RawText, callIndex: number) => FakeScanStep;
  /** Source used when a step does not set one (default: ON_DEVICE). */
  readonly source?: InferenceSourceKind;
  /** Microtask yields per call, so overlapping calls would interleave in the log. */
  readonly yields?: number;
}

const DEFAULT_YIELDS = 3;

/**
 * Deterministic IdentityScanner for tests, E2E and demo mode. Records every chunk it
 * receives and a start/end event log (to prove calls never overlap). No Firebase, no
 * timers, no randomness. The recorded chunks stay in memory and are never logged.
 */
export class FakeIdentityScanner implements IdentityScanner {
  readonly chunks: RawText[] = [];
  readonly events: string[] = [];
  private active = 0;
  private peak = 0;
  private readonly options: FakeIdentityScannerOptions;

  constructor(options: FakeIdentityScannerOptions = {}) {
    this.options = options;
  }

  /** Highest number of scans that were running at the same time. */
  get maxConcurrent(): number {
    return this.peak;
  }

  async scan(chunk: RawText): Promise<Result<IdentityScanResult, AppError>> {
    const callIndex = this.chunks.length;
    this.chunks.push(chunk);
    this.events.push(`start:${callIndex}`);
    this.active += 1;
    this.peak = Math.max(this.peak, this.active);
    for (let i = 0; i < (this.options.yields ?? DEFAULT_YIELDS); i++) await Promise.resolve();
    this.active -= 1;
    this.events.push(`end:${callIndex}`);
    return this.toResult(this.stepFor(chunk, callIndex));
  }

  private stepFor(chunk: RawText, callIndex: number): FakeScanStep {
    const step = this.options.steps?.[callIndex];
    if (step !== undefined) return step;
    return this.options.respond?.(chunk, callIndex) ?? { findings: [] };
  }

  private toResult(step: FakeScanStep): Result<IdentityScanResult, AppError> {
    if ('error' in step) return err(step.error);
    return ok({
      findings: [...step.findings],
      protectedQuotes: [...(step.protectedQuotes ?? [])],
      source: step.source ?? this.options.source ?? 'ON_DEVICE',
      retries: step.retries ?? 0,
    });
  }
}
