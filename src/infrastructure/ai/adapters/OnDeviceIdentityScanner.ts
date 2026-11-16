import type { PromptModule } from '../../../ai/prompts/promptModule';
import type { ModelFindingCategory } from '../../../ai/schemas/identityScan';
import type {
  IdentityScanner,
  IdentityScanResult,
} from '../../../application/ports/IdentityScanner';
import type { RawText } from '../../../domain/text/brandedText';
import type { AppError } from '../../../shared/appError';
import type { Result } from '../../../shared/result';
import type { PromptRunner } from '../onDevicePromptRunner';
import { scanAllGroups, type GroupPass } from './groupPasses';

/** Builds the runner (and so the model) for one category group. */
export type GroupRunnerFactory = (group: readonly ModelFindingCategory[]) => PromptRunner;

/** What the scanner needs from a prompt version: the user prompt and the output parser. */
export type ScanPrompt = Pick<PromptModule, 'buildUserPrompt' | 'parse'>;

/**
 * IdentityScanner on Chrome's on-device model. One call per category group of the
 * chosen strategy (in order, through the shared serial queue), each validated by the
 * prompt version's parser and retried once on invalid output; any other failure fails
 * the chunk. Findings and protected quotes are unioned across passes (groupPasses.ts).
 * Every result is ON_DEVICE: the runner discards anything else (fail-closed layer 3).
 */
export class OnDeviceIdentityScanner implements IdentityScanner {
  private readonly passes: readonly GroupPass<RawText>[];
  private readonly prompt: ScanPrompt;

  constructor(
    groups: readonly (readonly ModelFindingCategory[])[],
    runnerFor: GroupRunnerFactory,
    prompt: ScanPrompt,
  ) {
    this.prompt = prompt;
    this.passes = groups.map((group) => ({ group, runner: runnerFor(group) }));
  }

  scan(chunk: RawText): Promise<Result<IdentityScanResult, AppError>> {
    return scanAllGroups(this.passes, this.prompt.parse, this.prompt.buildUserPrompt(chunk));
  }
}
