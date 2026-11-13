import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPT_MODULE, getPromptModule } from './promptRegistry';

describe('promptRegistry', () => {
  it('resolves v1 by its version and rejects unknown versions', () => {
    expect(getPromptModule('identityScan.v1')).toBe(DEFAULT_PROMPT_MODULE);
    expect(getPromptModule('identityScan.v0')).toBeUndefined();
  });
});
