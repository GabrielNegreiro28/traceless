import type { VerifyPromptModule } from '../../../ai/prompts/disclosureVerify.v1';
import type { OnDeviceModelSpec } from '../modelFactory';

/** The on-device model configuration of the candidate verifier (task `disclosureVerify`). */
export function disclosureVerifyModelSpec(prompt: VerifyPromptModule): OnDeviceModelSpec {
  return {
    task: 'disclosureVerify',
    groupKey: prompt.version,
    initialPrompts: prompt.buildInitialPrompts(),
    responseConstraint: prompt.buildSchema(),
  };
}
