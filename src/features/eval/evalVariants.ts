import { IDENTITY_SCAN_PROMPT_VERSION, MODEL_CHUNK_CHARS } from '../../ai/prompts/identityScan.v1';
import { v2Pipeline, type ScanPipelineSpec } from '../../ai/prompts/scanPipelines';
import type { StrategyName } from '../../ai/prompts/strategies';

/**
 * One scan pipeline under evaluation. `promptVersion` must be registered in
 * src/ai/prompts/promptRegistry.ts; `postFilters` names the deterministic filters applied
 * to the model findings. Adding a variant = adding a line to EVAL_VARIANTS.
 */
export interface EvalVariant extends ScanPipelineSpec {
  readonly id: string;
}

function v2(id: string, strategy: StrategyName): EvalVariant {
  return { id, ...v2Pipeline(strategy) };
}

/**
 * Registered variants, in the order the Dev matrix runs them (M0–M3 of
 * docs/design/fase2-gate-iteration.md §E). Ids are file-name safe. `v2-single2` is built
 * exactly like the shipped pipeline (SHIPPED_SCAN_PIPELINE, §G.1).
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
