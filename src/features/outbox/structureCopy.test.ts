import { describe, expect, it } from 'vitest';
import { structureBadge } from './structureCopy';

describe('structureBadge', () => {
  it('follows where the model really ran (inferenceSource), not the policy default', () => {
    expect(structureBadge('ON_DEVICE', false)).toEqual({
      variant: 'onDevice',
      label: 'Organized on your device',
    });
    expect(structureBadge('IN_CLOUD', false)).toEqual({
      variant: 'cloud',
      label: 'Organized in the cloud — only your approved text',
    });
  });

  it('labels the demo organizer as no AI, whatever the source', () => {
    for (const source of ['ON_DEVICE', 'IN_CLOUD'] as const) {
      expect(structureBadge(source, true)).toEqual({
        variant: 'rules',
        label: 'Organized by the demo organizer (no AI)',
      });
    }
  });
});
