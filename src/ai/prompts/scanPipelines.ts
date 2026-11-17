import type { PostFilterName } from '../../domain/detection/postFilters';
import { DEFAULT_RULE_PACK, type RulePack } from '../../domain/detection/rulePacks';
import { MODEL_CHUNK_CHARS } from './identityScan.v1';
import { IDENTITY_SCAN_V2_PROMPT_VERSION } from './identityScan.v2';
import { IDENTITY_SCAN_V3_INVESTIGATOR_PROMPT_VERSION } from './identityScan.v3-investigator';
import type { StrategyName } from './strategies';

/** One identity-scan pass over each chunk: a registered prompt version and a strategy. */
export interface ScanPassSpec {
  readonly promptVersion: string;
  readonly strategy: StrategyName;
}

/**
 * What defines a scan pipeline: the primary scan pass (prompt version registered in
 * promptRegistry.ts + strategy), the report characters per model call, the deterministic
 * post-filters applied to the model findings (src/domain/detection/postFilters.ts) and the
 * deterministic rule pack run over the full text (src/domain/detection/rulePacks.ts).
 * Optional passes (absent = the pipeline is exactly as before): `extraScans` run after the
 * primary pass on each chunk, findings unioned; `verify` adds the Layer-3a candidate verifier
 * (one more on-device call per chunk with candidates) after the scan passes. Every model
 * finding, verified ones included, goes through the same post-filters and one merge.
 */
export interface ScanPipelineSpec extends ScanPassSpec {
  readonly chunkChars: number;
  readonly postFilters: readonly PostFilterName[];
  readonly rulePack: RulePack;
  readonly extraScans?: readonly ScanPassSpec[];
  readonly verify?: boolean;
}

/** Every scan pass of a pipeline, in order: the primary one, then the extra ones. */
export function scanPassesOf(spec: ScanPipelineSpec): ScanPassSpec[] {
  const primary: ScanPassSpec = { promptVersion: spec.promptVersion, strategy: spec.strategy };
  return [primary, ...(spec.extraScans ?? [])];
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

const V2_SINGLE: ScanPassSpec = {
  promptVersion: IDENTITY_SCAN_V2_PROMPT_VERSION,
  strategy: 'single',
};
const INVESTIGATOR: ScanPassSpec = {
  promptVersion: IDENTITY_SCAN_V3_INVESTIGATOR_PROMPT_VERSION,
  strategy: 'single',
};

/**
 * Round-3 pipelines (DECISIONS 2026-11-17): the v3 investigator pass always, plus the v2
 * single pass (`base`) and/or the candidate verifier (`verify`); first-person rules, v2
 * post-filters, the shipped chunk size. Calls per chunk = 1 + base + verify.
 */
export function v3Pipeline(options: {
  readonly base: boolean;
  readonly verify: boolean;
}): ScanPipelineSpec {
  const primary = options.base ? V2_SINGLE : INVESTIGATOR;
  return {
    ...primary,
    chunkChars: MODEL_CHUNK_CHARS,
    postFilters: V2_POST_FILTERS,
    rulePack: 'core+firstPerson',
    ...(options.base ? { extraScans: [INVESTIGATOR] } : {}),
    ...(options.verify ? { verify: true } : {}),
  };
}

/**
 * The pipeline the product ships on the device: `v3-verifier+investigator` (the investigator
 * pass, then the Layer-3a candidate verifier; first-person rules, v2 post-filters). The eval
 * variant of that id IS this object (src/features/eval/evalVariants.ts), so what was measured
 * is what ships.
 *
 * Chosen by the pre-registered round-3 rule and run once on the v2 test split
 * (docs/progress/DECISIONS.md, 2026-11-17: strict recall 0.709, ACCUSED 0.072 in the
 * conditional band), so the UI must never present the check as complete.
 */
export const SHIPPED_SCAN_PIPELINE: ScanPipelineSpec = v3Pipeline({ base: false, verify: true });

/**
 * The scan pass of the consented cloud scan (no Nano on this device), for every pipeline:
 * the v2 prompt with `single2`, unchanged since it shipped (DECISIONS 2026-11-16). It is
 * bound explicitly, never derived from a pipeline's primary pass, and the candidate verifier
 * never runs in the cloud (`disclosureVerify` is RAW, ONLY_ON_DEVICE). The cloud scan shares
 * the pipeline's chunk size, post-filters and rule pack.
 */
export const CONSENTED_CLOUD_SCAN_PASS: ScanPassSpec = {
  promptVersion: IDENTITY_SCAN_V2_PROMPT_VERSION,
  strategy: 'single2',
};
