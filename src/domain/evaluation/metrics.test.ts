import { describe, expect, it } from 'vitest';
import { aggregateRuns } from './aggregateRuns';
import { evaluateGate, GATE_THRESHOLDS } from './gate';
import { overlapRatio, spansMatch } from './matching';
import { countReport, type EvalFinding, type ReportCounts } from './reportCounts';
import type { ResolvedGold, ResolvedMustNot } from './resolveSpans';
import { percentile, summarizeCounts } from './summary';

const span = (start: number, end: number) => ({ start, end });

const GOLD: ResolvedGold[] = [
  { quote: 'g1', category: 'ROLE_UNIQUE', span: span(0, 10) },
  { quote: 'g2', category: 'LOCATION', span: span(20, 30) },
  { quote: 'g3', category: 'SCHEDULE', span: span(40, 50) },
];
const MUST_NOT: ResolvedMustNot[] = [
  { quote: 'm1', kind: 'ACCUSED', span: span(60, 70) },
  { quote: 'm2', kind: 'INCIDENT_FACT', span: span(80, 90) },
];
const RULE: EvalFinding[] = [{ span: span(0, 10), category: 'ROLE_UNIQUE', origin: 'RULE' }];
const MODEL: EvalFinding[] = [
  { span: span(22, 28), category: 'PERSONAL_TRAIT', origin: 'MODEL' },
  { span: span(62, 68), category: 'LOCATION', origin: 'MODEL' },
  { span: span(100, 230), category: 'LOCATION', origin: 'MODEL' },
];

function scanned(
  rule: EvalFinding[],
  model: EvalFinding[],
  merged: EvalFinding[] = [...rule, ...model],
): ReportCounts {
  return countReport({
    gold: GOLD,
    mustNot: MUST_NOT,
    scan: {
      ok: true,
      findings: merged,
      ruleFindings: rule,
      modelFindings: model,
      rawModelFindings: 5,
      unlocatedModelFindings: 1,
      durationMs: 40,
    },
  });
}

const failed = (kind: 'InvalidModelOutput' | 'Offline') =>
  countReport({ gold: GOLD, mustNot: MUST_NOT, scan: { ok: false, errorKind: kind } });

describe('overlap matching', () => {
  it('uses the shorter span as denominator and a 0.5 threshold', () => {
    expect(overlapRatio(span(0, 10), span(5, 15))).toBe(0.5);
    expect(spansMatch(span(0, 10), span(5, 15))).toBe(true);
    expect(spansMatch(span(0, 10), span(6, 16))).toBe(false);
    expect(spansMatch(span(0, 100), span(10, 20))).toBe(true);
    expect(overlapRatio(span(0, 5), span(5, 9))).toBe(0);
    expect(overlapRatio(span(3, 3), span(0, 9))).toBe(0);
  });
});

describe('summarizeCounts', () => {
  const metrics = summarizeCounts([scanned(RULE, MODEL)]);

  it('computes recall, precision, category and coverage figures exactly', () => {
    expect(metrics.combinedRecall).toBeCloseTo(2 / 3);
    expect(metrics.combinedRecallAll).toBeCloseTo(2 / 3);
    expect(metrics.strictRecall).toBeCloseTo(2 / 3);
    expect(metrics.modelOnlyRecall).toBe(0.5);
    expect(metrics.softPrecision).toBe(0.5);
    expect(metrics.categoryAccuracy).toBe(0.5);
    expect(metrics.goldCoverage).toBeCloseTo(0.8);
    expect(metrics['recall:ROLE_UNIQUE']).toBe(1);
    expect(metrics['recall:SCHEDULE']).toBe(0);
    expect(metrics['recall:TEAM_SIZE']).toBeNull();
  });

  it('computes must-not violations by kind and origin', () => {
    expect(metrics['violation:ACCUSED']).toBe(1);
    expect(metrics['violation:ACCUSED:MODEL']).toBe(1);
    expect(metrics['violation:ACCUSED:RULE']).toBe(0);
    expect(metrics['violation:INCIDENT_FACT']).toBe(0);
    expect(metrics['violation:OTHER_PERSON']).toBeNull();
  });

  it('computes oversized, hallucination, failure and latency figures', () => {
    expect(metrics.oversizedRate).toBe(0.25);
    expect(metrics.hallucinatedQuoteRate).toBeCloseTo(0.2);
    expect(metrics.invalidOutputRate).toBe(0);
    expect(metrics.scanFailureRate).toBe(0);
    expect(metrics.latencyP50Ms).toBe(40);
    expect(metrics.latencyMaxMs).toBe(40);
  });

  it('attributes origin from the pre-merge lists, not from merged findings', () => {
    const swallowed: EvalFinding[] = [
      { span: span(0, 12), category: 'ROLE_UNIQUE', origin: 'MODEL' },
    ];
    const m = summarizeCounts([scanned(RULE, swallowed, swallowed)]);
    expect(m.combinedRecall).toBeCloseTo(1 / 3);
    expect(m.modelOnlyRecall).toBe(0);
  });

  it('keeps oversized findings from counting as precise hits', () => {
    const wide: EvalFinding[] = [{ span: span(0, 45), category: 'ROLE_UNIQUE', origin: 'MODEL' }];
    const m = summarizeCounts([scanned([], wide)]);
    expect(m.combinedRecall).toBe(1);
    expect(m.strictRecall).toBe(0);
    expect(m.softPrecision).toBe(0);
    expect(m.oversizedRate).toBe(1);
  });

  it('allows 30 extra chars for short gold before calling a finding oversized', () => {
    const slack: EvalFinding[] = [{ span: span(0, 40), category: 'ROLE_UNIQUE', origin: 'MODEL' }];
    expect(summarizeCounts([scanned([], slack)]).oversizedRate).toBe(0);
  });

  it('judges category by the best-overlap matching finding only', () => {
    const mixed: EvalFinding[] = [
      { span: span(16, 26), category: 'LOCATION', origin: 'MODEL' },
      { span: span(20, 30), category: 'TEAM_SIZE', origin: 'MODEL' },
    ];
    expect(summarizeCounts([scanned([], mixed)]).categoryAccuracy).toBe(0);
  });

  it('measures how much of a matched gold the union of findings covers', () => {
    const halves: EvalFinding[] = [
      { span: span(20, 23), category: 'LOCATION', origin: 'MODEL' },
      { span: span(22, 26), category: 'LOCATION', origin: 'MODEL' },
    ];
    expect(summarizeCounts([scanned([], halves)]).goldCoverage).toBeCloseTo(0.6);
  });

  it('sums counts across reports before dividing', () => {
    const perfect = scanned(
      [
        { span: span(0, 10), category: 'ROLE_UNIQUE', origin: 'RULE' },
        { span: span(20, 30), category: 'LOCATION', origin: 'RULE' },
        { span: span(40, 50), category: 'SCHEDULE', origin: 'RULE' },
      ],
      [],
    );
    expect(summarizeCounts([scanned(RULE, MODEL), perfect]).combinedRecall).toBeCloseTo(5 / 6);
  });
});

describe('failed scans', () => {
  it('are counted in the failure rates and per kind', () => {
    const m = summarizeCounts([scanned(RULE, MODEL), failed('InvalidModelOutput')]);
    expect(m.scanFailureRate).toBe(0.5);
    expect(m.invalidOutputRate).toBe(0.5);
    expect(m['scanFailure:InvalidModelOutput']).toBe(0.5);
    expect(m['scanFailure:Offline']).toBe(0);
  });

  it('count their gold as missed in the All recalls only', () => {
    const m = summarizeCounts([scanned(RULE, MODEL), failed('Offline')]);
    expect(m.combinedRecall).toBeCloseTo(2 / 3);
    expect(m.combinedRecallAll).toBeCloseTo(2 / 6);
    expect(m.strictRecallAll).toBeCloseTo(2 / 6);
    expect(m.invalidOutputRate).toBe(0);
    expect(m.scanFailureRate).toBe(0.5);
  });

  it('leave quality rates undefined when nothing succeeded', () => {
    const m = summarizeCounts([failed('Offline')]);
    expect(m.combinedRecall).toBeNull();
    expect(m.combinedRecallAll).toBe(0);
    expect(m.latencyP50Ms).toBeNull();
  });
});

describe('percentile', () => {
  it('uses nearest rank', () => {
    expect(percentile([5, 1, 3, 2], 0.5)).toBe(2);
    expect(percentile([5, 1, 3], 0.5)).toBe(3);
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe('aggregateRuns', () => {
  it('returns mean, min, max and missing runs, skipping undefined values', () => {
    const stats = aggregateRuns([
      { a: 0.5, b: null, c: 1 },
      { a: 1, b: null, c: null },
      { a: 0, b: null, c: 3 },
    ]);
    expect(stats.a).toEqual({ mean: 0.5, min: 0, max: 1, missingRuns: 0 });
    expect(stats.b).toEqual({ mean: null, min: null, max: null, missingRuns: 3 });
    expect(stats.c).toEqual({ mean: 2, min: 1, max: 3, missingRuns: 1 });
  });
});

describe('evaluateGate', () => {
  const passing = {
    strictRecallAll: GATE_THRESHOLDS.strictRecallAll,
    'violation:ACCUSED': GATE_THRESHOLDS.accusedViolations,
    'violation:INCIDENT_FACT': GATE_THRESHOLDS.incidentFactViolations,
    invalidOutputRate: GATE_THRESHOLDS.invalidOutputRate,
    scanFailureRate: GATE_THRESHOLDS.scanFailureRate,
    oversizedRate: GATE_THRESHOLDS.oversizedRate,
  };
  const stable = aggregateRuns([passing, passing]);

  it('passes exactly at the thresholds', () => {
    const gate = evaluateGate(passing, stable);
    expect(gate.pass).toBe(true);
    expect(gate.unstable).toBe(false);
    expect(gate.checks).toHaveLength(6);
  });

  it('reports each failing criterion on the pooled value', () => {
    const gate = evaluateGate(
      { ...passing, strictRecallAll: 0.69, oversizedRate: 0.3, scanFailureRate: 0.06 },
      stable,
    );
    expect(gate.pass).toBe(false);
    expect(gate.checks.filter((c) => !c.pass).map((c) => c.metric)).toEqual([
      'strictRecallAll',
      'scanFailureRate',
      'oversizedRate',
    ]);
  });

  it('flags a pooled pass whose worst run breaches the threshold as unstable', () => {
    const perRun = aggregateRuns([
      { ...passing, strictRecallAll: 0.9 },
      { ...passing, strictRecallAll: 0.5 },
    ]);
    const gate = evaluateGate(passing, perRun);
    expect(gate.pass).toBe(true);
    expect(gate.unstable).toBe(true);
    expect(gate.checks[0]).toMatchObject({ worstRun: 0.5, unstable: true });
  });

  it('fails when a gated metric is undefined in any run or pooled', () => {
    const perRun = aggregateRuns([passing, { ...passing, scanFailureRate: null }]);
    const gate = evaluateGate(passing, perRun);
    expect(gate.pass).toBe(false);
    expect(gate.checks.find((c) => c.metric === 'scanFailureRate')?.missingRuns).toBe(1);
    expect(evaluateGate({ ...passing, invalidOutputRate: null }, stable).pass).toBe(false);
  });
});
