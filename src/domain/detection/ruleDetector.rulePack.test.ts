import { describe, expect, it } from 'vitest';
import { toRawText } from '../text/brandedText';
import { detectFirstPerson } from './firstPersonRules';
import { detectByRules } from './ruleDetector';
import { DEFAULT_RULE_PACK, RULE_PACKS, rulePackOrDefault } from './rulePacks';

const TEXT = toRawText(
  "I'm the only glassblower and I work nights. Mail me at kiln.keeper@example.org.\n\nR. V.",
);

describe('detectByRules: rule packs (§G.3)', () => {
  it('defaults to the core pack: no first-person findings', () => {
    expect(DEFAULT_RULE_PACK).toBe('core');
    expect(detectByRules(TEXT)).toEqual(detectByRules(TEXT, 'core'));
    expect(detectByRules(TEXT).map((f) => f.category)).toEqual([
      'DIRECT_IDENTIFIER',
      'DIRECT_IDENTIFIER',
    ]);
  });

  it('core+firstPerson adds the first-person findings, in text order', () => {
    const found = detectByRules(TEXT, 'core+firstPerson');
    expect(found.map((f) => [f.quote, f.category])).toEqual([
      ['the only glassblower', 'ROLE_UNIQUE'],
      ['work nights', 'SCHEDULE'],
      ['kiln.keeper@example.org', 'DIRECT_IDENTIFIER'],
      ['R. V.', 'DIRECT_IDENTIFIER'],
    ]);
    expect(found.every((f) => f.origin === 'RULE')).toBe(true);
    const firstPersonIds = new Set(detectFirstPerson(TEXT).map((f) => f.id));
    expect(found.filter((f) => !firstPersonIds.has(f.id))).toEqual(detectByRules(TEXT, 'core'));
  });

  it('a missing rule pack (old result files) means core', () => {
    expect(RULE_PACKS).toEqual(['core', 'core+firstPerson']);
    expect(rulePackOrDefault(undefined)).toBe('core');
    expect(rulePackOrDefault('core+firstPerson')).toBe('core+firstPerson');
  });
});
