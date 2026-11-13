import { describe, expect, it } from 'vitest';
import { MODEL_FINDING_CATEGORIES, buildIdentityScanSchema } from '../schemas/identityScan';
import { STRATEGIES, buildInitialPrompts } from './identityScan.v1';
import { getPromptModule } from './promptRegistry';

/**
 * v1 reproducibility guard: the identity-scan v1 schema and prompts must stay
 * byte-identical to what produced eval/results/identityScan.v1-*, whatever later
 * versions add (outlets, few-shots, strategies).
 */
const V1_FULL_SCHEMA_JSON =
  '{"type":"object","properties":{"findings":{"type":"array","maxItems":12,"items":{"type":"object","properties":{"quote":{"type":"string"},"category":{"type":"string","enum":["ROLE_UNIQUE","SCHEDULE","LOCATION","PERSONAL_EVENT_DATE","PERSONAL_TRAIT","TEAM_SIZE","DIRECT_IDENTIFIER"]},"reason":{"type":"string"},"suggestion":{"type":"string"}},"required":["quote","category","reason","suggestion"]}}},"required":["findings"]}';

/** FNV-1a (32-bit) fingerprint of a string, so long prompts can be frozen compactly. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const V1_PROMPT_FINGERPRINTS: Readonly<Record<string, string>> = {
  single: '4a8b55d8',
  grouped0: '46aa812c',
  grouped1: '19c3e81f',
};

describe('identityScan.v1 reproducibility', () => {
  it('builds the same schema JSON as before outlets existed', () => {
    expect(JSON.stringify(buildIdentityScanSchema(MODEL_FINDING_CATEGORIES))).toBe(
      V1_FULL_SCHEMA_JSON,
    );
    const v1 = getPromptModule('identityScan.v1');
    expect(JSON.stringify(v1?.buildSchema(MODEL_FINDING_CATEGORIES))).toBe(V1_FULL_SCHEMA_JSON);
  });

  it('keeps the v1 initial prompts byte-identical', () => {
    const groups = {
      single: STRATEGIES.single[0],
      grouped0: STRATEGIES.grouped2[0],
      grouped1: STRATEGIES.grouped2[1],
    };
    const actual = Object.fromEntries(
      Object.entries(groups).map(([name, group]) => [
        name,
        fingerprint(JSON.stringify(buildInitialPrompts(group))),
      ]),
    );
    expect(actual).toEqual(V1_PROMPT_FINGERPRINTS);
  });
});
