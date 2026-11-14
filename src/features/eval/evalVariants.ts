import { IDENTITY_SCAN_PROMPT_VERSION, MODEL_CHUNK_CHARS } from '../../ai/prompts/identityScan.v1';
import { v2Pipeline, type ScanPipelineSpec } from '../../ai/prompts/scanPipelines';
import type { StrategyName } from '../../ai/prompts/strategies';
import type { RulePack } from '../../domain/detection/rulePacks';

/**
 * One scan pipeline under evaluation. `promptVersion` must be registered in
 * src/ai/prompts/promptRegistry.ts; `postFilters` names the deterministic filters applied
 * to the model findings; `rulePack` the deterministic rules. Adding a variant = adding a
 * line to EVAL_VARIANTS.
 */
export interface EvalVariant extends ScanPipelineSpec {
  readonly id: string;
}

function v2(id: string, strategy: StrategyName, rulePack: RulePack = 'core'): EvalVariant {
  return { id, ...v2Pipeline(strategy, rulePack) };
}

/**
 * Registered variants, in the order the Dev matrix runs them: M0–M3 of
 * docs/design/fase2-gate-iteration.md §E, then the §G.4 round-2 pair (v2 prompt, v2-single2
 * post-filters, core + first-person rules). Ids are file-name safe. `v2-single2` is built
 * exactly like the shipped pipeline (SHIPPED_SCAN_PIPELINE, §G.1).
 */
export const EVAL_VARIANTS: readonly EvalVariant[] = [
  {
    id: 'v1-single',
    promptVersion: IDENTITY_SCAN_PROMPT_VERSION,
    strategy: 'single',
    chunkChars: MODEL_CHUNK_CHARS,
    postFilters: [],
    rulePack: 'core',
  },
  v2('v2-single', 'single'),
  v2('v2-grouped2', 'grouped2'),
  v2('v2-single2', 'single2'),
  v2('v2-single2-rules', 'single2', 'core+firstPerson'),
  v2('v2-single3-rules', 'single3', 'core+firstPerson'),
];

/**
 * The round-1 Dev matrix variants (M0–M3, §E), pinned so the "Dev matrix" preset never grows
 * silently when a variant is registered.
 */
export const MATRIX_VARIANT_IDS: readonly string[] = [
  'v1-single',
  'v2-single',
  'v2-grouped2',
  'v2-single2',
];

/** The §G.4 round-2 variants, run by the "Round 2" preset (dev, 3 runs). */
export const ROUND2_VARIANT_IDS: readonly string[] = ['v2-single2-rules', 'v2-single3-rules'];

export const DEFAULT_EVAL_VARIANT: EvalVariant = EVAL_VARIANTS[0] as EvalVariant;

export function findVariant(id: string): EvalVariant | undefined {
  return EVAL_VARIANTS.find((v) => v.id === id);
}
