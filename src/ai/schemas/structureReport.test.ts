import { describe, expect, it } from 'vitest';
import { MAX_SUMMARY_CHARS, REPORT_CATEGORIES } from '../../domain/report/structuredReport';
import { buildStructureReportSchema, clampText, parseStructuredReport } from './structureReport';

const answer = (fields: Record<string, unknown>) =>
  JSON.stringify({ category: 'safety', summary: 'Batteries shipped unlabelled.', ...fields });

describe('buildStructureReportSchema', () => {
  it('requires the four fields with the closed category enum', () => {
    const schema = buildStructureReportSchema();
    expect(schema.required).toEqual(['category', 'summary', 'when', 'where']);
    expect(schema.properties?.category).toEqual({ type: 'string', enum: [...REPORT_CATEGORIES] });
  });

  it('returns a fresh object on every call', () => {
    expect(buildStructureReportSchema()).not.toBe(buildStructureReportSchema());
  });
});

describe('parseStructuredReport', () => {
  it('parses a valid answer; "" means not stated', () => {
    const result = parseStructuredReport(answer({ when: 'on 14 March', where: '' }));
    expect(result).toEqual({
      ok: true,
      value: {
        category: 'safety',
        summary: 'Batteries shipped unlabelled.',
        when: 'on 14 March',
        where: null,
      },
    });
  });

  it('clamps the summary to the limit', () => {
    const result = parseStructuredReport(
      answer({ summary: 'word '.repeat(80), when: '', where: '' }),
    );
    expect(result.ok && result.value.summary.length).toBeLessThanOrEqual(MAX_SUMMARY_CHARS);
    expect(result.ok && result.value.summary.endsWith('…')).toBe(true);
  });

  it.each([
    ['not JSON', '{oops'],
    ['an unknown category', answer({ category: 'theft', when: '', where: '' })],
    ['a missing field', answer({ when: '' })],
    ['an empty summary', answer({ summary: '  ', when: '', where: '' })],
  ])('rejects %s as InvalidModelOutput without echoing it', (_label, text) => {
    const result = parseStructuredReport(text);
    expect(result).toMatchObject({ ok: false, error: { kind: 'InvalidModelOutput' } });
    expect(JSON.stringify(result)).not.toContain('Batteries');
  });
});

describe('clampText', () => {
  it('collapses whitespace and leaves short text alone', () => {
    expect(clampText('  a \n b ', 10)).toBe('a b');
  });
});
