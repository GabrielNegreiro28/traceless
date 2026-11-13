import type { PromptModule } from '../../../ai/prompts/promptModule';
import type { ModelFindingCategory } from '../../../ai/schemas/identityScan';
import type {
  IdentityScanner,
  IdentityScanResult,
} from '../../../application/ports/IdentityScanner';
import type { ModelFinding } from '../../../domain/detection/types';
import type { RawText } from '../../../domain/text/brandedText';
import type { AppError } from '../../../shared/appError';
import { err, ok, type Result } from '../../../shared/result';
import type { PromptRunner } from '../onDevicePromptRunner';

/** Builds the runner (and so the model) for one category group. */
export type GroupRunnerFactory = (group: readonly ModelFindingCategory[]) => PromptRunner;

/** What the scanner needs from a prompt version: the user prompt and the output parser. */
export type ScanPrompt = Pick<PromptModule, 'buildUserPrompt' | 'parse'>;

/** Invalid model output gets exactly one more try (design §2). */
const MAX_RETRIES = 1;

interface GroupPass {
  readonly group: readonly ModelFindingCategory[];
  readonly runner: PromptRunner;
}

interface GroupScan {
  readonly findings: ModelFinding[];
  readonly protectedQuotes: readonly string[];
  readonly retries: number;
}

async function scanGroup(
  pass: GroupPass,
  parse: ScanPrompt['parse'],
  prompt: RawText,
  attempt = 0,
): Promise<Result<GroupScan, AppError>> {
  const output = await pass.runner.run(prompt);
  if (!output.ok) return err(output.error);
  const parsed = parse(output.value.text, pass.group);
  if (parsed.ok) return ok({ ...parsed.value, retries: attempt });
  return attempt < MAX_RETRIES ? scanGroup(pass, parse, prompt, attempt + 1) : parsed;
}

/** Union across groups: the same quote with the same category is kept once. */
function uniqueFindings(findings: readonly ModelFinding[]): ModelFinding[] {
  const byKey = new Map<string, ModelFinding>();
  for (const finding of findings) {
    const key = `${finding.category}\u0000${finding.quote}`;
    if (!byKey.has(key)) byKey.set(key, finding);
  }
  return [...byKey.values()];
}

/**
 * IdentityScanner on Chrome's on-device model. One call per category group of the
 * chosen strategy (in order, through the shared serial queue), each validated by the
 * prompt version's parser and retried once on invalid output; any other failure fails
 * the chunk. Findings and protected quotes are unioned across passes. Every result is
 * ON_DEVICE: the runner discards anything else (fail-closed layer 3).
 */
export class OnDeviceIdentityScanner implements IdentityScanner {
  private readonly passes: readonly GroupPass[];
  private readonly prompt: ScanPrompt;

  constructor(
    groups: readonly (readonly ModelFindingCategory[])[],
    runnerFor: GroupRunnerFactory,
    prompt: ScanPrompt,
  ) {
    this.prompt = prompt;
    this.passes = groups.map((group) => ({ group, runner: runnerFor(group) }));
  }

  async scan(chunk: RawText): Promise<Result<IdentityScanResult, AppError>> {
    const prompt = this.prompt.buildUserPrompt(chunk);
    const findings: ModelFinding[] = [];
    const protectedQuotes = new Set<string>();
    let retries = 0;
    for (const pass of this.passes) {
      const scanned = await scanGroup(pass, this.prompt.parse, prompt);
      if (!scanned.ok) return err(scanned.error);
      findings.push(...scanned.value.findings);
      for (const quote of scanned.value.protectedQuotes) protectedQuotes.add(quote);
      retries += scanned.value.retries;
    }
    return ok({
      findings: uniqueFindings(findings),
      protectedQuotes: [...protectedQuotes],
      source: 'ON_DEVICE',
      retries,
    });
  }
}
