import type { PromptModule } from '../../../ai/prompts/promptModule';
import type { ModelFindingCategory } from '../../../ai/schemas/identityScan';
import type {
  IdentityScanResult,
  InferenceSourceKind,
} from '../../../application/ports/IdentityScanner';
import type { ModelFinding } from '../../../domain/detection/types';
import type { AppError } from '../../../shared/appError';
import { err, ok, type Result } from '../../../shared/result';

/**
 * The identity-scan passes shared by the on-device and the consented cloud scanners: one
 * model call per category group, each validated by the prompt version's parser and retried
 * once on invalid output, findings and protected quotes unioned across passes. Generic over
 * the runner's input, so each adapter keeps its own input brand (RawText prompt on the device,
 * ConsentedRawText chunk in the cloud) and neither can be handed the other's text.
 */

/** One model answer and where it actually ran. */
export interface GroupRunOutput {
  readonly text: string;
  readonly source: InferenceSourceKind;
}

export interface GroupRunner<I> {
  /** `isCancelled` is polled before a retry of a transient failure (runners that retry). */
  run(input: I, isCancelled?: () => boolean): Promise<Result<GroupRunOutput, AppError>>;
}

export interface GroupPass<I> {
  readonly group: readonly ModelFindingCategory[];
  readonly runner: GroupRunner<I>;
}

export type ScanParse = PromptModule['parse'];

/** Invalid model output gets exactly one more try (design §2). */
const MAX_RETRIES = 1;

interface GroupScan {
  readonly findings: ModelFinding[];
  readonly protectedQuotes: readonly string[];
  readonly retries: number;
  readonly source: InferenceSourceKind;
}

async function scanGroup<I>(
  pass: GroupPass<I>,
  parse: ScanParse,
  input: I,
  isCancelled: (() => boolean) | undefined,
  attempt = 0,
): Promise<Result<GroupScan, AppError>> {
  const output = await pass.runner.run(input, isCancelled);
  if (!output.ok) return err(output.error);
  const parsed = parse(output.value.text, pass.group);
  if (parsed.ok) return ok({ ...parsed.value, retries: attempt, source: output.value.source });
  return attempt < MAX_RETRIES ? scanGroup(pass, parse, input, isCancelled, attempt + 1) : parsed;
}

/** Union across groups (and scanners): the same quote with the same category is kept once. */
export function uniqueFindings(findings: readonly ModelFinding[]): ModelFinding[] {
  const byKey = new Map<string, ModelFinding>();
  for (const finding of findings) {
    const key = `${finding.category}\u0000${finding.quote}`;
    if (!byKey.has(key)) byKey.set(key, finding);
  }
  return [...byKey.values()];
}

/**
 * Runs every pass in order; any failure fails the chunk. The result is IN_CLOUD as soon as
 * one pass ran off the device (callers that need on-device results fail closed on it).
 */
export async function scanAllGroups<I>(
  passes: readonly GroupPass<I>[],
  parse: ScanParse,
  input: I,
  isCancelled?: () => boolean,
): Promise<Result<IdentityScanResult, AppError>> {
  const findings: ModelFinding[] = [];
  const protectedQuotes = new Set<string>();
  let retries = 0;
  let source: InferenceSourceKind = 'ON_DEVICE';
  for (const pass of passes) {
    const scanned = await scanGroup(pass, parse, input, isCancelled);
    if (!scanned.ok) return err(scanned.error);
    findings.push(...scanned.value.findings);
    for (const quote of scanned.value.protectedQuotes) protectedQuotes.add(quote);
    retries += scanned.value.retries;
    if (scanned.value.source === 'IN_CLOUD') source = 'IN_CLOUD';
  }
  return ok({
    findings: uniqueFindings(findings),
    protectedQuotes: [...protectedQuotes],
    source,
    retries,
  });
}
