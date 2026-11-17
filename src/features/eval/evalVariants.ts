import { IDENTITY_SCAN_PROMPT_VERSION, MODEL_CHUNK_CHARS } from '../../ai/prompts/identityScan.v1';
import { v2Pipeline, v3Pipeline, type ScanPipelineSpec } from '../../ai/prompts/scanPipelines';
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
 * post-filters, core + first-person rules), then the three pre-registered round-3 cascades
 * (DECISIONS 2026-11-17). Ids are file-name safe. `v2-single2-rules` is the shipped pipeline
 * (SHIPPED_SCAN_PIPELINE, §G.5).
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
  { id: 'v3-base+investigator', ...v3Pipeline({ base: true, verify: false }) },
  { id: 'v3-verifier+investigator', ...v3Pipeline({ base: false, verify: true }) },
  { id: 'v3-base+verifier+investigator', ...v3Pipeline({ base: true, verify: true }) },
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

/** The shipped pipeline: the baseline of round 3 and of the final v2 test. */
export const BASELINE_VARIANT_ID = 'v2-single2-rules';

/**
 * Round 3 (DECISIONS 2026-11-17, pre-registered): the three cascades, then the shipped
 * baseline, run on the whole v1 dev pool.
 */
export const ROUND3_VARIANT_IDS: readonly string[] = [
  'v3-base+investigator',
  'v3-verifier+investigator',
  'v3-base+verifier+investigator',
  BASELINE_VARIANT_ID,
];

export const DEFAULT_EVAL_VARIANT: EvalVariant = EVAL_VARIANTS[0] as EvalVariant;

export function findVariant(id: string): EvalVariant | undefined {
  return EVAL_VARIANTS.find((v) => v.id === id);
}
