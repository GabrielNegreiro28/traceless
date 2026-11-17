import type {
  IdentityScanner,
  IdentityScanResult,
  InferenceSourceKind,
} from '../../../application/ports/IdentityScanner';
import type { ModelFinding } from '../../../domain/detection/types';
import type { RawText } from '../../../domain/text/brandedText';
import type { AppError } from '../../../shared/appError';
import { err, ok, type Result } from '../../../shared/result';
import { uniqueFindings } from './groupPasses';

/**
 * Runs several identity scanners (for example the v2 prompt, then the v3 investigator prompt)
 * over the same chunk, strictly in order, and unions their results exactly like the group
 * passes of one scanner: findings deduplicated by quote and category, protected quotes
 * unioned, retries summed. Any failure fails the chunk; IN_CLOUD as soon as one scanner was.
 */
export class SequentialIdentityScanner implements IdentityScanner {
  private readonly scanners: readonly IdentityScanner[];

  constructor(scanners: readonly IdentityScanner[]) {
    this.scanners = scanners;
  }

  async scan(chunk: RawText): Promise<Result<IdentityScanResult, AppError>> {
    const findings: ModelFinding[] = [];
    const protectedQuotes = new Set<string>();
    let retries = 0;
    let source: InferenceSourceKind = 'ON_DEVICE';
    for (const scanner of this.scanners) {
      const scanned = await scanner.scan(chunk);
      if (!scanned.ok) return err(scanned.error);
      findings.push(...scanned.value.findings);
      for (const quote of scanned.value.protectedQuotes) protectedQuotes.add(quote);
      retries += scanned.value.retries;
      if (scanned.value.source === 'IN_CLOUD') source = 'IN_CLOUD';
    }
    return ok({
      findings: uniqueFindings(findings),
      protectedQuotes: [...protectedQuotes],
      source,
      retries,
    });
  }
}
