import { describe, expect, it } from 'vitest';
import { policyFor } from '../../../ai/policy/inferencePolicy';
import {
  IDENTITY_SCAN_PROMPT_VERSION,
  STRATEGIES,
  buildInitialPrompts,
} from '../../../ai/prompts/identityScan.v1';
import { getPromptModule } from '../../../ai/prompts/promptRegistry';
import { buildIdentityScanSchema } from '../../../ai/schemas/identityScan';
import { identityScanModelSpec } from './identityScanModelSpec';

const V1 = getPromptModule(IDENTITY_SCAN_PROMPT_VERSION)!;

describe('identityScanModelSpec', () => {
  it('builds the RAW, on-device-only identity-scan spec for a group', () => {
    const group = STRATEGIES.grouped2[1];
    const spec = identityScanModelSpec(group, V1);
    expect(spec.task).toBe('identityScan');
    expect(policyFor(spec.task)).toMatchObject({ dataClass: 'RAW', mode: 'only_on_device' });
    expect(spec.initialPrompts).toEqual(buildInitialPrompts(group));
    expect(spec.responseConstraint).toEqual(buildIdentityScanSchema(group));
  });

  it('keys each group and prompt version separately', () => {
    const keys = [...STRATEGIES.single, ...STRATEGIES.grouped2].map(
      (group) => identityScanModelSpec(group, V1).groupKey,
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key.startsWith(`${IDENTITY_SCAN_PROMPT_VERSION}:`)).toBe(true);
  });
});
