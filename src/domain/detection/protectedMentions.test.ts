import { describe, expect, it } from 'vitest';
import { toRawText } from '../text/brandedText';
import { buildProtectedTerms, suppressProtected } from './protectedMentions';
import type { Finding, FindingOrigin } from './types';

const TEXT = toRawText(
  'The night auditor, Mr. Bellweather-Quist, voids room charges. ' +
    'Payments go through the night auditor and the front desk team on weekends. ' +
    'Bellweather-Quist keeps the cash. I report to Bellweather-Quist on Sundays. ' +
    'Write to bquist@inn.example for the ledger.',
);

/** A finding on the n-th occurrence (0-based) of `quote` in TEXT. */
function at(quote: string, origin: FindingOrigin = 'MODEL', nth = 0): Finding {
  let start = TEXT.indexOf(quote);
  for (let i = 0; i < nth; i++) start = TEXT.indexOf(quote, start + 1);
  if (start < 0) throw new Error(`fixture quote not found: ${quote}`);
  const span = { start, end: start + quote.length };
  return {
    id: `${origin}:${start}`,
    span,
    quote,
    category: 'ROLE_UNIQUE',
    reason: 'r',
    suggestion: null,
    origin,
  };
}

function quotesOf(findings: readonly Finding[]): string[] {
  return findings.map((f) => f.quote);
}

describe('buildProtectedTerms', () => {
  it('keeps trimmed unique phrases and their name tokens without honorifics', () => {
    const terms = buildProtectedTerms([
      ' Dr. Jane Ruiz-Ortega ',
      "Ruiz-Ortega's office",
      'Dr. Jane Ruiz-Ortega',
      '  ',
    ]);
    expect(terms.phrases).toEqual(['Dr. Jane Ruiz-Ortega', "Ruiz-Ortega's office"]);
    expect(terms.names).toEqual(['Jane', 'Ruiz-Ortega']);
  });

  it('ignores quotes that speak as the writer, so they can never shield anything', () => {
    const terms = buildProtectedTerms(['my colleague Arvid', 'I am Priya', 'the porter, Osei']);
    expect(terms).toEqual({ phrases: ['the porter, Osei'], names: ['Osei'] });
  });
});

describe('suppressProtected', () => {
  const terms = buildProtectedTerms(['The night auditor, Mr. Bellweather-Quist']);

  it('drops a model finding covered by a protected phrase (honorific included)', () => {
    const result = suppressProtected(TEXT, [at('night auditor, Mr. Bellweather-Quist')], terms);
    expect(result.kept).toEqual([]);
    expect(quotesOf(result.suppressed)).toEqual(['night auditor, Mr. Bellweather-Quist']);
  });

  it('drops a finding at least half covered by one occurrence, keeps one that is not', () => {
    const phraseOnly = buildProtectedTerms(['the night auditor']);
    const mostly = at('the night auditor and the front');
    const barely = at('auditor and the front desk team on weekends', 'MODEL', 0);
    const result = suppressProtected(TEXT, [mostly, barely], phraseOnly);
    expect(quotesOf(result.suppressed)).toEqual([mostly.quote]);
    expect(quotesOf(result.kept)).toEqual([barely.quote]);
  });

  it('drops every later bare mention of a protected name (multi-occurrence)', () => {
    const mention = at('Bellweather-Quist keeps the cash');
    const result = suppressProtected(TEXT, [mention], terms);
    expect(result.suppressed).toEqual([mention]);
    // The first mention merges into the introduction; the two bare mentions stay separate.
    expect(result.protectedSpans.map((s) => TEXT.slice(s.start, s.end))).toEqual([
      'The night auditor, Mr. Bellweather-Quist',
      'Bellweather-Quist',
      'Bellweather-Quist',
    ]);
  });

  it('never suppresses a finding that speaks in the first person singular', () => {
    const mine = at('I report to Bellweather-Quist on Sundays');
    expect(suppressProtected(TEXT, [mine], terms).kept).toEqual([mine]);
  });

  it('never suppresses a RULE finding, even fully inside a protected phrase', () => {
    const email = at('bquist@inn.example', 'RULE');
    const withEmail = buildProtectedTerms(['bquist@inn.example', 'Bellweather-Quist']);
    expect(suppressProtected(TEXT, [email], withEmail).kept).toEqual([email]);
  });

  it('keeps findings that share no protected term, in input order', () => {
    const findings = [at('the front desk team'), at('room charges')];
    const result = suppressProtected(TEXT, findings, terms);
    expect(result.kept).toEqual(findings);
    expect(result.suppressed).toEqual([]);
  });

  it('returns sorted, merged protected spans for the "kept" chips', () => {
    const { protectedSpans } = suppressProtected(TEXT, [], terms);
    const intro = 'The night auditor, Mr. Bellweather-Quist';
    expect(protectedSpans[0]).toEqual({ start: 0, end: intro.length });
    const starts = protectedSpans.map((s) => s.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(protectedSpans).toHaveLength(3);
  });

  it('protects nothing when there are no protected quotes', () => {
    const findings = [at('Bellweather-Quist keeps the cash')];
    const result = suppressProtected(TEXT, findings, buildProtectedTerms([]));
    expect(result).toEqual({ kept: findings, suppressed: [], protectedSpans: [] });
  });
});
