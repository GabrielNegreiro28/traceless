import type { ConsentedRawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';
import type { IdentityScanResult } from './IdentityScanner';

/**
 * Finds quasi-identifiers of the writer in ONE chunk of text the reporter explicitly agreed
 * to send to the cloud (docs/design/fase3-product-plan.md §2b). A port of its own, on
 * purpose: the on-device `IdentityScanner` accepts RawText only and is never widened to a
 * union, so raw text cannot reach a cloud-capable scanner by type, and consented text never
 * reaches the on-device path by accident.
 */
export interface ConsentedIdentityScanner {
  scan(chunk: ConsentedRawText): Promise<Result<IdentityScanResult, AppError>>;
}
