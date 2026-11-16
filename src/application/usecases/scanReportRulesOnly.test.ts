import { describe, expect, it } from 'vitest';
import { detectByRules } from '../../domain/detection/ruleDetector';
import { toRawText } from '../../domain/text/brandedText';
import { scanReportRulesOnly } from './scanReportRulesOnly';

const TEXT = toRawText(
  'I am the only night nurse on ward 7. On 12 March 2026 the head nurse changed the log. ' +
    'Write to night.nurse@example.com.',
);

describe('scanReportRulesOnly', () => {
  it('returns only the pattern-rule findings, all with origin RULE', () => {
    const { findings } = scanReportRulesOnly(TEXT);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.origin === 'RULE')).toBe(true);
    expect(findings.map((f) => f.quote)).toContain('night.nurse@example.com');
    expect(findings.map((f) => f.quote)).not.toContain('only night nurse');
  });

  it('is exactly the rule detector merged (deterministic)', () => {
    expect(scanReportRulesOnly(TEXT).findings.map((f) => f.id)).toEqual(
      detectByRules(TEXT, 'core+firstPerson').map((f) => f.id),
    );
    expect(scanReportRulesOnly(TEXT)).toEqual(scanReportRulesOnly(TEXT));
  });

  it('finds nothing in a text without direct identifiers or dates', () => {
    expect(scanReportRulesOnly(toRawText('Nothing here points to anyone.')).findings).toEqual([]);
  });
});
