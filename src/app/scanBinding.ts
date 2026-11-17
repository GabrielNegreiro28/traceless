import type { PromptModule } from '../ai/prompts/promptModule';
import { getPromptModule } from '../ai/prompts/promptRegistry';
import {
  scanPassesOf,
  type ScanPassSpec,
  type ScanPipelineSpec,
} from '../ai/prompts/scanPipelines';
import { STRATEGIES } from '../ai/prompts/strategies';
import type { ModelFindingCategory } from '../ai/schemas/identityScan';
import type { IdentityScanner } from '../application/ports/IdentityScanner';
import { scanReport } from '../application/usecases/scanReport';
import type { DisclosureVerification } from '../application/ports/DisclosureVerification';
import { systemClock } from '../infrastructure/clock/systemClock';
import type { Services } from './servicesContract';

/** Part of the composition root: from a pipeline spec to its passes and its bound scan. */

/** One scan pass, resolved: the category groups of its strategy and its prompt module. */
export interface ScanSetup {
  readonly groups: readonly (readonly ModelFindingCategory[])[];
  readonly prompt: PromptModule;
}

/** One scan pass, resolved. An unregistered prompt version throws. */
export function resolveScanPass({ promptVersion, strategy }: ScanPassSpec): ScanSetup {
  const prompt = getPromptModule(promptVersion);
  if (prompt === undefined) throw new Error(`Unknown prompt version: ${promptVersion}`);
  return { groups: STRATEGIES[strategy], prompt };
}

/** Every scan pass of `variant`, in order. An unregistered prompt version throws. */
export function resolveScanSetups(variant: ScanPipelineSpec): ScanSetup[] {
  return scanPassesOf(variant).map(resolveScanPass);
}

/** Cache key: every field that changes what a scan does. */
export function variantKey(v: ScanPipelineSpec): string {
  const passes = scanPassesOf(v).map((p) => `${p.promptVersion}/${p.strategy}`);
  return `${passes.join('+')}|${v.chunkChars}|${v.postFilters.join(',')}|${v.rulePack}|${v.verify === true ? 'verify' : ''}`;
}

/** The on-device scan use case bound to a scanner, a variant and (optionally) the verifier. */
export function bindScanReport(
  scanner: IdentityScanner,
  variant: ScanPipelineSpec,
  disclosure?: DisclosureVerification,
): Services['scanReport'] {
  const { chunkChars, postFilters, rulePack } = variant;
  const deps = {
    scanner,
    clock: systemClock,
    chunkChars,
    postFilters,
    rulePack,
    ...(disclosure === undefined ? {} : { disclosure }),
  };
  return (text, onProgress, isCancelled) =>
    scanReport(text, deps, {
      ...(onProgress === undefined ? {} : { onProgress }),
      ...(isCancelled === undefined ? {} : { isCancelled }),
    });
}
