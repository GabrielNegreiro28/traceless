import { IDENTITY_SCAN_PROMPT_VERSION, MODEL_CHUNK_CHARS } from '../../ai/prompts/identityScan.v1';
import type { StrategyName } from '../../ai/prompts/identityScan.v1';

/**
 * One scan pipeline under evaluation. `promptVersion` must be registered in
 * src/ai/prompts/promptRegistry.ts; `postFilters` names post-filters applied to the
 * model findings (none exist yet). Adding a variant = adding a line to EVAL_VARIANTS.
 */
export interface EvalVariant {
  readonly id: string;
  readonly promptVersion: string;
  readonly strategy: StrategyName;
  readonly chunkChars: number;
  readonly postFilters: readonly string[];
}

/** Registered variants, in the order the Dev matrix runs them. Ids are file-name safe. */
export const EVAL_VARIANTS: readonly EvalVariant[] = [
  {
    id: 'v1-single',
    promptVersion: IDENTITY_SCAN_PROMPT_VERSION,
    strategy: 'single',
    chunkChars: MODEL_CHUNK_CHARS,
    postFilters: [],
  },
];

export const DEFAULT_EVAL_VARIANT: EvalVariant = EVAL_VARIANTS[0] as EvalVariant;

export function findVariant(id: string): EvalVariant | undefined {
  return EVAL_VARIANTS.find((v) => v.id === id);
}
