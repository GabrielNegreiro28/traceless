import { describe, expect, it } from 'vitest';
import { getPromptModule } from '../../../ai/prompts/promptRegistry';
import { CONSENTED_CLOUD_SCAN_PASS } from '../../../ai/prompts/scanPipelines';
import { STRATEGIES } from '../../../ai/prompts/strategies';
import { toRawText } from '../../../domain/text/brandedText';
import { consentedScanModelSpec } from './consentedScanModelSpec';
import { identityScanModelSpec } from './identityScanModelSpec';

const PROMPT = getPromptModule(CONSENTED_CLOUD_SCAN_PASS.promptVersion)!;
const GROUP = STRATEGIES[CONSENTED_CLOUD_SCAN_PASS.strategy][0];

describe('consentedScanModelSpec', () => {
  const cloud = consentedScanModelSpec(GROUP, PROMPT);
  const onDevice = identityScanModelSpec(GROUP, PROMPT);

  it('uses the consented task (CONSENTED_RAW, cloud only)', () => {
    expect(cloud.task).toBe('identityScanConsented');
  });

  it('sends the same system prompt the on-device model gets', () => {
    const system = onDevice.initialPrompts[0];
    expect(system?.role).toBe('system');
    expect(cloud.systemInstruction).toBe(system?.content[0]?.value);
  });

  it('sends the same few-shots, schema and user prompt as the on-device model', () => {
    expect(cloud.fewShots).toHaveLength(onDevice.initialPrompts.length - 1);
    expect(cloud.responseSchema).toEqual(onDevice.responseConstraint);
    const chunk = toRawText('I am the only night nurse.');
    expect(cloud.buildUserPrompt(chunk)).toBe(PROMPT.buildUserPrompt(chunk));
  });
});
