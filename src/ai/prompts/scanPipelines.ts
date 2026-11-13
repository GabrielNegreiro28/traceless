import type { PostFilterName } from '../../domain/detection/postFilters';
import { MODEL_CHUNK_CHARS } from './identityScan.v1';
import { IDENTITY_SCAN_V2_PROMPT_VERSION } from './identityScan.v2';
import type { StrategyName } from './strategies';

/**
 * What defines a scan pipeline: the prompt version (registered in promptRegistry.ts), the
 * strategy, the report characters per model call and the deterministic post-filters applied
 * to the model findings (src/domain/detection/postFilters.ts).
 */
export interface ScanPipelineSpec {
  readonly promptVersion: string;
  readonly strategy: StrategyName;
  readonly chunkChars: number;
  readonly postFilters: readonly PostFilterName[];
}

/** Every v2 pipeline runs both post-filters (docs/design/fase2-gate-iteration.md §B). */
export const V2_POST_FILTERS: readonly PostFilterName[] = ['protectedMentions', 'thirdPerson'];

/** The v2 prompt with `strategy`, the shipped chunk size and the v2 post-filters. */
export function v2Pipeline(strategy: StrategyName): ScanPipelineSpec {
  return {
    promptVersion: IDENTITY_SCAN_V2_PROMPT_VERSION,
    strategy,
    chunkChars: MODEL_CHUNK_CHARS,
    postFilters: V2_POST_FILTERS,
  };
}

/**
 * The pipeline the product ships: exactly the `v2-single2` eval variant (both are built by
 * `v2Pipeline('single2')`).
 *
 * docs/design/fase2-gate-iteration.md §G.1: this is a default BY DOMINANCE, NOT a gate pass.
 * On the dev matrix v2-single2 beat v1-single on precision and ACCUSED violations at equal
 * recall within noise, and no variant reached the recall gate. The final default is whichever
 * variant goes to the test split (§G.4).
 */
export const SHIPPED_SCAN_PIPELINE: ScanPipelineSpec = v2Pipeline('single2');
