import { describe, expect, it } from 'vitest';
import { MODEL_FINDING_CATEGORIES } from '../schemas/identityScan';
import { DEFAULT_PROMPT_MODULE, getPromptModule } from './promptRegistry';

const ALL = MODEL_FINDING_CATEGORIES;
const OUTPUT = JSON.stringify({
  findings: [
    { quote: 'the head brewer, Tomasz', category: 'REPORTED_PERSON', reason: 'r', suggestion: '' },
    { quote: 'my locker', category: 'LOCATION', reason: 'r', suggestion: '' },
  ],
});

describe('promptRegistry', () => {
  it('resolves v1 by its version and rejects unknown versions', () => {
    expect(getPromptModule('identityScan.v1')).toBe(DEFAULT_PROMPT_MODULE);
    expect(getPromptModule('identityScan.v0')).toBeUndefined();
  });

  it('keeps v1 as the shipped default until the gate picks another version', () => {
    expect(DEFAULT_PROMPT_MODULE.version).toBe('identityScan.v1');
    expect(getPromptModule('identityScan.v2')?.version).toBe('identityScan.v2');
  });

  it('v1 has no outlets: its schema and parser ignore REPORTED_PERSON/OTHER_PERSON', () => {
    const v1 = getPromptModule('identityScan.v1')!;
    expect(JSON.stringify(v1.buildSchema(ALL))).not.toContain('REPORTED_PERSON');
    const parsed = v1.parse(OUTPUT, ALL);
    expect(parsed.ok && parsed.value.protectedQuotes).toEqual([]);
    expect(parsed.ok && parsed.value.findings.map((f) => f.quote)).toEqual(['my locker']);
  });

  it('v2 has both outlets in its schema and turns outlet items into protected quotes', () => {
    const v2 = getPromptModule('identityScan.v2')!;
    const schema = JSON.stringify(v2.buildSchema(ALL));
    expect(schema).toContain('"REPORTED_PERSON","OTHER_PERSON"');
    const parsed = v2.parse(OUTPUT, ALL);
    expect(parsed.ok && parsed.value.protectedQuotes).toEqual(['the head brewer, Tomasz']);
    expect(parsed.ok && parsed.value.findings.map((f) => f.quote)).toEqual(['my locker']);
  });
});
