import { describe, expect, it } from 'vitest';
import {
  addRecall,
  formatFinding,
  labelFinding,
  locateQuote,
  missedGold,
  overlapRatio,
  recallTable,
  resolveGold,
  resolveMustNot,
  verifyTiming,
  type DatasetReportLite,
  type FindingLite,
} from './evalInspectHelpers.ts';

const REPORT: DatasetReportLite = {
  id: 'rx',
  text: 'I am the only nurse. Ms. Okafor took 31 boxes. I work nights. I work nights.',
  gold: [
    { quote: 'the only nurse', category: 'ROLE_UNIQUE' },
    { quote: 'I work nights', category: 'SCHEDULE', occurrence: 2 },
    { quote: 'Ms.', category: 'PERSONAL_TRAIT' },
  ],
  mustNotFlag: [
    { quote: 'Ms. Okafor', kind: 'ACCUSED' },
    { quote: '31 boxes', kind: 'INCIDENT_FACT' },
  ],
};

const finding = (quote: string, category = 'ROLE_UNIQUE', occurrence = 1): FindingLite => {
  const span = locateQuote(REPORT.text, quote, occurrence);
  if (span === null) throw new Error('quote missing');
  return { span, category, origin: 'MODEL' };
};

describe('eval inspect helpers', () => {
  it('locates the Nth occurrence and rejects missing or empty quotes', () => {
    expect(locateQuote('ab ab', 'ab', 2)).toEqual({ start: 3, end: 5 });
    expect(locateQuote('ab', 'zz')).toBeNull();
    expect(locateQuote('ab', '')).toBeNull();
  });

  it('matches at an overlap ratio of 0.5 over the shorter span', () => {
    expect(overlapRatio({ start: 0, end: 10 }, { start: 5, end: 7 })).toBe(1);
    expect(overlapRatio({ start: 0, end: 4 }, { start: 2, end: 8 })).toBe(0.5);
    expect(overlapRatio({ start: 0, end: 2 }, { start: 2, end: 4 })).toBe(0);
  });

  it('labels findings by gold, must-not kind or nothing', () => {
    const gold = resolveGold(REPORT);
    const mustNot = resolveMustNot(REPORT);
    const label = (q: string) => labelFinding(finding(q), gold, mustNot);
    expect(label('only nurse')).toBe('GOLD-hit');
    expect(label('Okafor')).toBe('ACCUSED');
    expect(label('31 boxes')).toBe('INCIDENT_FACT');
    expect(label('took')).toBe('unannotated');
    expect(labelFinding(finding('I work nights', 'SCHEDULE', 2), gold, mustNot)).toBe('GOLD-hit');
    expect(label('Ms. Okafor')).toBe('ACCUSED+GOLD-hit');
  });

  it('lists missed gold and tallies recall per category', () => {
    const gold = resolveGold(REPORT);
    const missed = missedGold([finding('the only nurse')], gold);
    expect(missed.map((m) => m.label)).toEqual(['SCHEDULE', 'PERSONAL_TRAIT']);
    const tally = {};
    addRecall(tally, gold, missed);
    const rows = recallTable(tally).map((row) => row.replaceAll(/\s+/g, ' '));
    expect(rows).toEqual([
      'PERSONAL_TRAIT 0/1 0.0%',
      'ROLE_UNIQUE 1/1 100.0%',
      'SCHEDULE 0/1 0.0%',
      'ALL 1/3 33.3%',
    ]);
  });

  it('prints the quote of a finding on one line', () => {
    const line = formatFinding(REPORT.text, finding('the only nurse'), 'GOLD-hit');
    expect(line).toBe('  [GOLD-hit] ROLE_UNIQUE (MODEL) "the only nurse"');
  });
});

describe('verifyTiming', () => {
  it('reports mean and max over the reports that recorded verifyMs', () => {
    expect(verifyTiming([{ verifyMs: 100 }, { verifyMs: 0 }, { verifyMs: null }, {}])).toEqual({
      mean: 50,
      max: 100,
      reports: 2,
    });
  });

  it('is null for result files without per-pass timing', () => {
    expect(verifyTiming([{}, { verifyMs: null }])).toBeNull();
    expect(verifyTiming([])).toBeNull();
  });
});
