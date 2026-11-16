import type { ModelFindingCategory } from '../../../ai/schemas/identityScan';
import type { ConsentedIdentityScanner } from '../../../application/ports/ConsentedIdentityScanner';
import type { IdentityScanResult } from '../../../application/ports/IdentityScanner';
import type { ConsentedRawText } from '../../../domain/text/brandedText';
import type { AppError } from '../../../shared/appError';
import type { Result } from '../../../shared/result';
import { scanAllGroups, type GroupPass, type GroupRunner, type ScanParse } from './groupPasses';

/** Builds the cloud runner (and so the model) for one category group. */
export type ConsentedRunnerFactory = (
  group: readonly ModelFindingCategory[],
) => GroupRunner<ConsentedRawText>;

/**
 * ConsentedIdentityScanner on the cloud model (ONLY_IN_CLOUD), used only after the reporter's
 * explicit consent for this text. It runs the same passes as the on-device scanner
 * (groupPasses.ts: one call per category group of the shipped strategy, the prompt version's
 * parser, one retry on invalid output, union of findings), so results stay comparable. The
 * result carries where the passes really ran.
 */
export class ConsentedCloudIdentityScanner implements ConsentedIdentityScanner {
  private readonly passes: readonly GroupPass<ConsentedRawText>[];
  private readonly parse: ScanParse;

  constructor(
    groups: readonly (readonly ModelFindingCategory[])[],
    runnerFor: ConsentedRunnerFactory,
    parse: ScanParse,
  ) {
    this.parse = parse;
    this.passes = groups.map((group) => ({ group, runner: runnerFor(group) }));
  }

  scan(
    chunk: ConsentedRawText,
    isCancelled?: () => boolean,
  ): Promise<Result<IdentityScanResult, AppError>> {
    return scanAllGroups(this.passes, this.parse, chunk, isCancelled);
  }
}
