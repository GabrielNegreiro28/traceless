import type { PromptModule } from '../../../ai/prompts/promptModule';
import type { ModelFindingCategory } from '../../../ai/schemas/identityScan';
import type { OnDeviceModelSpec } from '../modelFactory';

/** The on-device model configuration for one category group of one prompt version. */
export function identityScanModelSpec(
  group: readonly ModelFindingCategory[],
  prompt: PromptModule,
): OnDeviceModelSpec {
  return {
    task: 'identityScan',
    groupKey: `${prompt.version}:${group.join(',')}`,
    initialPrompts: prompt.buildInitialPrompts(group),
    responseConstraint: prompt.buildSchema(group),
  };
}
