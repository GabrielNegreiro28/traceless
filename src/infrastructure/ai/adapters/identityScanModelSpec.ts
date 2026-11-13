import {
  IDENTITY_SCAN_PROMPT_VERSION,
  buildInitialPrompts,
} from '../../../ai/prompts/identityScan.v1';
import {
  buildIdentityScanSchema,
  type ModelFindingCategory,
} from '../../../ai/schemas/identityScan';
import type { OnDeviceModelSpec } from '../modelFactory';

/** The on-device model configuration for one identity-scan category group. */
export function identityScanModelSpec(group: readonly ModelFindingCategory[]): OnDeviceModelSpec {
  return {
    task: 'identityScan',
    groupKey: `${IDENTITY_SCAN_PROMPT_VERSION}:${group.join(',')}`,
    initialPrompts: buildInitialPrompts(group),
    responseConstraint: buildIdentityScanSchema(group),
  };
}
