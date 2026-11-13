import { IDENTITY_SCAN_PROMPT_VERSION, MODEL_CHUNK_CHARS } from '../../ai/prompts/identityScan.v1';
import { IDENTITY_SCAN_V2_PROMPT_VERSION } from '../../ai/prompts/identityScan.v2';
import type { StrategyName } from '../../ai/prompts/strategies';
import type { PostFilterName } from '../../domain/detection/postFilters';

/**
 * One scan pipeline under evaluation. `promptVersion` must be registered in
 * src/ai/prompts/promptRegistry.ts; `postFilters` names the deterministic filters applied
 * to the model findings. Adding a variant = adding a line to EVAL_VARIANTS.
 */
export interface EvalVariant {
  readonly id: string;
  readonly promptVersion: string;
  readonly strategy: StrategyName;
  readonly chunkChars: number;
  readonly postFilters: readonly PostFilterName[];
}

const V2_FILTERS: readonly PostFilterName[] = ['protectedMentions', 'thirdPerson'];

function v2(id: string, strategy: StrategyName): EvalVariant {
  return {
    id,
    promptVersion: IDENTITY_SCAN_V2_PROMPT_VERSION,
    strategy,
    chunkChars: MODEL_CHUNK_CHARS,
    postFilters: V2_FILTERS,
  };
}

/**
 * Registered variants, in the order the Dev matrix runs them (M0–M3 of
 * docs/design/fase2-gate-iteration.md §E). Ids are file-name safe.
 */
export const EVAL_VARIANTS: readonly EvalVariant[] = [
  {
    id: 'v1-single',
    promptVersion: IDENTITY_SCAN_PROMPT_VERSION,
    strategy: 'single',
    chunkChars: MODEL_CHUNK_CHARS,
    postFilters: [],
  },
  v2('v2-single', 'single'),
  v2('v2-grouped2', 'grouped2'),
  v2('v2-single2', 'single2'),
];

export const DEFAULT_EVAL_VARIANT: EvalVariant = EVAL_VARIANTS[0] as EvalVariant;

export function findVariant(id: string): EvalVariant | undefined {
  return EVAL_VARIANTS.find((v) => v.id === id);
}
