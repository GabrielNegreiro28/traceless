import { describe, expect, it } from 'vitest';
import { MODEL_FINDING_CATEGORIES } from '../schemas/identityScan';
import { buildInitialPrompts, buildSystemPrompt } from './identityScan.v2';
import { FEW_SHOT_V2 } from './identityScan.v2.fewShots';
import { toCloudPrompt } from './cloudPrompt';

describe('toCloudPrompt', () => {
  const initial = buildInitialPrompts(MODEL_FINDING_CATEGORIES);
  const cloud = toCloudPrompt(initial);

  it('uses the v2 system prompt, unchanged, as the system instruction', () => {
    expect(cloud.systemInstruction).toBe(buildSystemPrompt(MODEL_FINDING_CATEGORIES));
  });

  it('keeps every few-shot pair, in order, as user/model turns with the same text', () => {
    expect(cloud.fewShots).toHaveLength(FEW_SHOT_V2.length * 2);
    expect(cloud.fewShots.map((turn) => turn.role)).toEqual(
      FEW_SHOT_V2.flatMap(() => ['user', 'model']),
    );
    const onDeviceTexts = initial.slice(1).map((m) => m.content[0]?.value);
    const cloudTexts = cloud.fewShots.map((turn) => {
      const part = turn.parts[0];
      return part !== undefined && 'text' in part ? part.text : undefined;
    });
    expect(cloudTexts).toEqual(onDeviceTexts);
  });

  it('ignores non-text content and works without any system message', () => {
    const prompt = toCloudPrompt([
      { role: 'user', content: [{ type: 'image', value: new ArrayBuffer(1) }] },
    ]);
    expect(prompt).toEqual({
      systemInstruction: '',
      fewShots: [{ role: 'user', parts: [{ type: 'text', text: '' }] }],
    });
  });
});
