import { toCloudPrompt } from '../../../ai/prompts/cloudPrompt';
import type { PromptModule } from '../../../ai/prompts/promptModule';
import type { ModelFindingCategory } from '../../../ai/schemas/identityScan';
import type { ConsentedCloudModelSpec } from '../consentedCloudModel';

/**
 * The consented cloud model configuration for one category group of one prompt version:
 * the same system prompt, few-shots, schema and user prompt as identityScanModelSpec gives
 * the on-device model, in the cloud request shape.
 */
export function consentedScanModelSpec(
  group: readonly ModelFindingCategory[],
  prompt: PromptModule,
): ConsentedCloudModelSpec {
  return {
    task: 'identityScanConsented',
    ...toCloudPrompt(prompt.buildInitialPrompts(group)),
    responseSchema: prompt.buildSchema(group),
    buildUserPrompt: prompt.buildUserPrompt,
  };
}
