import type { ConsentedIdentityScanner } from '../../application/ports/ConsentedIdentityScanner';
import type { IdentityScanResult } from '../../application/ports/IdentityScanner';
import type { ConsentedRawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { toResult, type FakeScanStep } from './FakeIdentityScanner';
import type { Result } from '../../shared/result';

export interface FakeConsentedIdentityScannerOptions {
  /** Answers for calls 0, 1, 2… in order; once exhausted, `respond` is used. */
  readonly steps?: readonly FakeScanStep[];
  /** Fallback answer per call (default: no findings). */
  readonly respond?: (chunk: ConsentedRawText, callIndex: number) => FakeScanStep;
}

/**
 * Deterministic ConsentedIdentityScanner for tests, E2E and demo mode. Answers IN_CLOUD by
 * default (like the real cloud scanner) and records the consented chunks it receives, in
 * memory only. No Firebase, no network, no timers.
 */
export class FakeConsentedIdentityScanner implements ConsentedIdentityScanner {
  readonly chunks: ConsentedRawText[] = [];
  private readonly options: FakeConsentedIdentityScannerOptions;

  constructor(options: FakeConsentedIdentityScannerOptions = {}) {
    this.options = options;
  }

  async scan(chunk: ConsentedRawText): Promise<Result<IdentityScanResult, AppError>> {
    const callIndex = this.chunks.length;
    this.chunks.push(chunk);
    await Promise.resolve();
    const step = this.options.steps?.[callIndex] ??
      this.options.respond?.(chunk, callIndex) ?? { findings: [] };
    return toResult(step, 'IN_CLOUD');
  }
}
