import type { PostFilterName } from '../../domain/detection/postFilters';
import { DEFAULT_RULE_PACK, type RulePack } from '../../domain/detection/rulePacks';
import { MODEL_CHUNK_CHARS } from './identityScan.v1';
import { IDENTITY_SCAN_V2_PROMPT_VERSION } from './identityScan.v2';
import type { StrategyName } from './strategies';

/**
 * What defines a scan pipeline: the prompt version (registered in promptRegistry.ts), the
 * strategy, the report characters per model call, the deterministic post-filters applied
 * to the model findings (src/domain/detection/postFilters.ts) and the deterministic rule
 * pack run over the full text (src/domain/detection/rulePacks.ts).
 */
export interface ScanPipelineSpec {
  readonly promptVersion: string;
  readonly strategy: StrategyName;
  readonly chunkChars: number;
  readonly postFilters: readonly PostFilterName[];
  readonly rulePack: RulePack;
}

/** Every v2 pipeline runs both post-filters (docs/design/fase2-gate-iteration.md §B). */
export const V2_POST_FILTERS: readonly PostFilterName[] = ['protectedMentions', 'thirdPerson'];

/** The v2 prompt with `strategy`, the shipped chunk size, the v2 post-filters and `rulePack`. */
export function v2Pipeline(
  strategy: StrategyName,
  rulePack: RulePack = DEFAULT_RULE_PACK,
): ScanPipelineSpec {
  return {
    promptVersion: IDENTITY_SCAN_V2_PROMPT_VERSION,
    strategy,
    chunkChars: MODEL_CHUNK_CHARS,
    postFilters: V2_POST_FILTERS,
    rulePack,
  };
}

/**
 * The pipeline the product ships: exactly the `v2-single2-rules` eval variant (both are built
 * by `v2Pipeline('single2', 'core+firstPerson')`).
 *
 * This is the variant measured on the test split (docs/progress/DECISIONS.md, 2026-11-16:
 * strict recall 0.60 against a 0.70 target, shipped with the miss disclosed), so the UI must
 * never present the check as complete.
 */
export const SHIPPED_SCAN_PIPELINE: ScanPipelineSpec = v2Pipeline('single2', 'core+firstPerson');
