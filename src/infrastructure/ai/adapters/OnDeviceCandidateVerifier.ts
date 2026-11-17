import type { VerifyPromptModule } from '../../../ai/prompts/disclosureVerify.v1';
import type {
  CandidateVerification,
  CandidateVerifier,
} from '../../../application/ports/CandidateVerifier';
import type { RawText } from '../../../domain/text/brandedText';
import type { AppError } from '../../../shared/appError';
import { logger } from '../../../shared/logger';
import { err, ok, type Result } from '../../../shared/result';
import type { PromptRunner } from '../onDevicePromptRunner';

/** What the verifier needs from a prompt version: the user prompt and the parser. */
export type VerifyPrompt = Pick<VerifyPromptModule, 'buildUserPrompt' | 'parse'>;

/** Invalid model output gets exactly one more try, like the identity scan. */
const MAX_RETRIES = 1;

const NOTHING_TO_VERIFY: CandidateVerification = { verdicts: [], source: 'ON_DEVICE', retries: 0 };

/**
 * CandidateVerifier on Chrome's on-device model (Layer 3a): one single-turn call per chunk
 * with the numbered candidates, through the shared serial queue and its stall recovery (the
 * runner). Invalid output is retried once; if it stays invalid the verifier contributes no
 * verdict (detection degrades to the other layers; nothing ever goes to the cloud). Runner
 * failures (stall, unavailable, off-device result) fail the call. No call without candidates.
 */
export class OnDeviceCandidateVerifier implements CandidateVerifier {
  private readonly runner: PromptRunner;
  private readonly prompt: VerifyPrompt;

  constructor(runner: PromptRunner, prompt: VerifyPrompt) {
    this.runner = runner;
    this.prompt = prompt;
  }

  async verify(
    chunk: RawText,
    candidates: readonly string[],
  ): Promise<Result<CandidateVerification, AppError>> {
    if (candidates.length === 0) return ok(NOTHING_TO_VERIFY);
    const input = this.prompt.buildUserPrompt(chunk, candidates);
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const output = await this.runner.run(input);
      if (!output.ok) return err(output.error);
      const parsed = this.prompt.parse(output.value.text, candidates.length);
      if (parsed.ok)
        return ok({ verdicts: parsed.value, source: output.value.source, retries: attempt });
    }
    logger.warn('candidate verifier output stayed invalid; no verdicts for this chunk', {
      candidates: candidates.length,
    });
    return ok({ verdicts: [], source: 'ON_DEVICE', retries: MAX_RETRIES });
  }
}
