import { describe, expect, it } from 'vitest';
import { toRawText } from '../text/brandedText';
import { FIRST_PERSON_FAMILIES, FIRST_PERSON_FAMILY_IDS } from './firstPersonFamilies';
import {
  detectFirstPerson,
  detectFirstPersonMatches,
  FIRST_PERSON_PACK,
  MAX_SPAN_WORDS,
  MIN_SPAN_WORDS,
} from './firstPersonRules';
import { MARKED_POSITIVES, parsePositive } from './firstPersonRules.testKit';

const ALL_POSITIVES = FIRST_PERSON_FAMILY_IDS.flatMap((id) =>
  MARKED_POSITIVES[id].map(parsePositive),
);

describe.each(FIRST_PERSON_FAMILY_IDS)('first-person family %s', (id) => {
  const family = FIRST_PERSON_FAMILIES[id];
  const positives = MARKED_POSITIVES[id].map(parsePositive);

  it('has at least six invented positives and a generic suggestion per pattern', () => {
    expect(positives.length).toBeGreaterThanOrEqual(6);
    for (const pattern of family.patterns) expect(pattern.suggestion.trim()).not.toBe('');
  });

  it.each(positives.map((p) => [p.span, p] as const))('flags exactly "%s"', (_, positive) => {
    const found = detectFirstPersonMatches(positive.text, [id]);
    expect(found.map((m) => [m.finding.quote, m.finding.span.start])).toEqual([
      [positive.span, positive.start],
    ]);
    const [match] = found;
    expect(match?.family).toBe(id);
    expect(match?.finding).toMatchObject({
      origin: 'RULE',
      category: family.category,
      reason: family.reason,
    });
    expect(family.patterns.map((p) => p.suggestion)).toContain(match?.finding.suggestion);
  });
});

describe('first-person span contract', () => {
  const findings = ALL_POSITIVES.flatMap((p) =>
    detectFirstPersonMatches(p.text, FIRST_PERSON_FAMILY_IDS).map((m) => ({ ...m, text: p.text })),
  );

  it('every finding is 2-8 whole words (a schedule range: its own limit), in one sentence', () => {
    expect(findings.length).toBeGreaterThanOrEqual(ALL_POSITIVES.length);
    for (const { finding, text, family } of findings) {
      const words = finding.quote.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(MIN_SPAN_WORDS);
      expect(words).toBeLessThanOrEqual(FIRST_PERSON_FAMILIES[family].maxWords ?? MAX_SPAN_WORDS);
      expect(text.slice(finding.span.start, finding.span.end)).toBe(finding.quote);
      expect(finding.quote).toBe(finding.quote.trim());
      expect(finding.quote.replace(/\b([ap])\.m\./gi, '$1m')).not.toMatch(/[!?;\n]|\.(?:\s|$)/);
      expect(text.charAt(finding.span.start - 1)).not.toMatch(/[A-Za-z0-9]/);
      expect(text.charAt(finding.span.end)).not.toMatch(/[A-Za-z0-9]/);
    }
  });

  it('finds every family in one paragraph, in text order', () => {
    const paragraph = ALL_POSITIVES.map((p) => p.text).join(' ');
    const found = detectFirstPersonMatches(paragraph, FIRST_PERSON_FAMILY_IDS);
    const starts = found.map((m) => m.finding.span.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(new Set(found.map((m) => m.family))).toEqual(new Set(FIRST_PERSON_FAMILY_IDS));
  });

  it('detectFirstPerson returns the findings of the enabled pack', () => {
    const text = toRawText("I'm the only glassblower and I work nights.");
    expect(detectFirstPerson(text)).toEqual(
      detectFirstPersonMatches(text, FIRST_PERSON_PACK).map((m) => m.finding),
    );
    expect(detectFirstPerson(text).map((f) => f.category)).toEqual(['ROLE_UNIQUE', 'SCHEDULE']);
  });

  it('is deterministic and keeps no regex state between calls', () => {
    const text = 'I work nights. I work nights.';
    const first = detectFirstPersonMatches(text);
    expect(detectFirstPersonMatches(text)).toEqual(first);
    expect(first.map((m) => m.finding.span)).toEqual([
      { start: 2, end: 13 },
      { start: 17, end: 28 },
    ]);
  });
});
