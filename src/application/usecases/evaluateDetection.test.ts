import { describe, expect, it } from 'vitest';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeIdentityScanner } from '../../infrastructure/fakes/FakeIdentityScanner';
import { createAppError } from '../../shared/appError';
import type { IdentityScanner } from '../ports/IdentityScanner';
import {
  evaluateDetection,
  type EvalProgress,
  type EvalRunResult,
  type EvalScan,
} from './evaluateDetection';
import { DATASET, VARIANT, mf, respond, runEval as run } from './evaluateDetection.testKit';
import { scanReport } from './scanReport';

function wrap(scanner: IdentityScanner, clock = new FakeClock(0, 5)): EvalScan {
  return (text) => scanReport(text, { scanner, clock, chunkChars: 3000 });
}

const fakeModel = () => new FakeIdentityScanner({ respond: (c) => respond(c) });

describe('evaluateDetection with a fake model', () => {
  it('runs the split sequentially and summarises exact metrics', async () => {
    const scanner = fakeModel();
    const progress: EvalProgress[] = [];
    const result = await run(wrap(scanner), 'all', 2, progress);

    expect(result.startedAt).toBe(1000);
    expect(result.promptVersion).toBe('p-test');
    expect(result.strategy).toBe('single');
    expect(result.variant).toEqual({ ...VARIANT, id: 'v-test', promptVersion: 'p-test' });
    expect(result.views.raw.summary).toEqual(result.summary);
    expect(result.views.filtered.runs).toEqual(result.runs);
    expect(result.runs).toHaveLength(2);
    expect(scanner.maxConcurrent).toBe(1);
    expect(progress.map((p) => `${p.run}:${p.reportsDone}:${p.reportId}`)).toEqual([
      '1:1:a',
      '1:2:b',
      '1:3:c',
      '2:1:a',
      '2:2:b',
      '2:3:c',
    ]);

    const metrics = result.runs[0]?.metrics;
    expect(metrics?.combinedRecall).toBe(1);
    expect(metrics?.modelOnlyRecall).toBe(1);
    expect(metrics?.['violation:ACCUSED']).toBe(1);
    expect(metrics?.['violation:ACCUSED:MODEL']).toBe(1);
    expect(metrics?.hallucinatedQuoteRate).toBeCloseTo(1 / 4);
    expect(result.summary.reports).toBe(3);
    expect(result.summary.metrics.combinedRecall).toEqual({
      mean: 1,
      min: 1,
      max: 1,
      missingRuns: 0,
    });
    expect(result.summary.pooled.combinedRecall).toBe(1);
    expect(result.gate).toBeNull();
  });

  it('filters by split and keeps the result JSON-serialisable without text', async () => {
    const result = await run(wrap(fakeModel()), 'test');
    expect(result.runs[0]?.reports.map((r) => r.reportId)).toEqual(['b', 'c']);
    const json = JSON.stringify(result);
    expect(JSON.parse(json)).toEqual(result);
    expect(json).not.toContain('jane@example.com');
    expect(json).not.toContain('desk 14');
  });

  it('fails the gate on the test split when there is no ACCUSED data', async () => {
    const result: EvalRunResult = await run(wrap(fakeModel()), 'test');
    const accused = result.gate?.checks.find((c) => c.metric === 'violation:ACCUSED');
    expect(accused?.pooled).toBeNull();
    expect(result.gate?.pass).toBe(false);
  });

  it('records scan errors per report and counts invalid output', async () => {
    const error = createAppError('InvalidModelOutput', { message: 'bad json' });
    const scanner = new FakeIdentityScanner({
      respond: (c, i) => (i === 0 ? { error } : respond(c)),
    });
    const result = await run(wrap(scanner), 'all');
    const reports = result.runs[0]?.reports ?? [];
    expect(reports.map((r) => r.errorKind)).toEqual(['InvalidModelOutput', null, null]);
    expect(result.runs[0]?.metrics.invalidOutputRate).toBeCloseTo(1 / 3);
    expect(result.runs[0]?.metrics.scanFailureRate).toBeCloseTo(1 / 3);
    expect(result.runs[0]?.metrics.combinedRecallAll).toBeCloseTo(2 / 4);
    expect(result.runs[0]?.metrics.combinedRecall).toBe(1);
  });

  it('turns a rejected scan into an Unknown failure without losing the run', async () => {
    let calls = 0;
    const throwing: EvalScan = (text) => {
      calls += 1;
      if (calls === 2) return Promise.reject(new Error('secret raw text ' + text));
      return wrap(fakeModel())(text);
    };
    const result = await run(throwing, 'all');
    expect(result.runs[0]?.reports.map((r) => r.errorKind)).toEqual([null, 'Unknown', null]);
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});

describe('evaluateDetection pooling', () => {
  it('pools as sum of hits over sum of gold, not the mean of per-run rates', async () => {
    const error = createAppError('InvalidModelOutput', { message: 'bad json' });
    const scanner = new FakeIdentityScanner({
      respond: (c, i) => {
        if (i === 0) return { error }; // run 1: report a fails and is not scanned
        if (i === 3) return { findings: [] }; // run 2: report a is scanned, model finds nothing
        return respond(c);
      },
    });
    const result = await run(wrap(scanner), 'all', 2);
    const [run1, run2] = result.runs;
    expect(run1?.metrics.combinedRecall).toBe(2 / 2);
    expect(run2?.metrics.combinedRecall).toBe(3 / 4);
    expect(result.summary.metrics.combinedRecall?.mean).toBeCloseTo(0.875);
    expect(result.summary.pooled.combinedRecall).toBeCloseTo(5 / 6);
  });
});

describe('evaluateDetection origin attribution', () => {
  const datedDataset = (mustNotKind: 'gold' | 'mustNot'): Dataset => ({
    version: 'dated',
    reports: [
      {
        id: 'd',
        sector: 'hr',
        split: 'test',
        text: 'I was hired on 2024-03-05 and nothing else matters.',
        gold:
          mustNotKind === 'gold' ? [{ quote: '2024-03-05', category: 'PERSONAL_EVENT_DATE' }] : [],
        mustNotFlag:
          mustNotKind === 'mustNot' ? [{ quote: '2024-03-05', kind: 'INCIDENT_FACT' }] : [],
      },
    ],
  });
  const swallowing = () =>
    wrap(
      new FakeIdentityScanner({
        respond: () => ({ findings: [mf('hired on 2024-03-05', 'PERSONAL_EVENT_DATE')] }),
      }),
    );

  async function runDated(mode: 'gold' | 'mustNot') {
    const result = await run(swallowing(), 'test', 1, undefined, datedDataset(mode));
    return result.runs[0]?.metrics;
  }

  it('credits a date to the rules even when a model quote swallows the rule hit', async () => {
    const metrics = await runDated('gold');
    expect(metrics?.combinedRecall).toBe(1);
    expect(metrics?.modelOnlyRecall).toBeNull();
  });

  it('attributes a must-not violation to both origins that flagged it', async () => {
    const metrics = await runDated('mustNot');
    expect(metrics?.['violation:INCIDENT_FACT']).toBe(1);
    expect(metrics?.['violation:INCIDENT_FACT:RULE']).toBe(1);
    expect(metrics?.['violation:INCIDENT_FACT:MODEL']).toBe(1);
  });
});

describe('evaluateDetection configuration errors', () => {
  const base = {
    dataset: DATASET,
    scan: wrap(new FakeIdentityScanner()),
    clock: new FakeClock(),
    variant: VARIANT,
  };

  it('rejects invalid run counts and empty splits', async () => {
    expect((await evaluateDetection({ ...base, split: 'all', runs: 0 })).ok).toBe(false);
    const empty = { ...DATASET, reports: DATASET.reports.filter((r) => r.split === 'dev') };
    expect((await evaluateDetection({ ...base, dataset: empty, split: 'test', runs: 1 })).ok).toBe(
      false,
    );
  });

  it('rejects datasets whose annotations do not resolve', async () => {
    const broken: Dataset = {
      version: 'x',
      reports: [{ ...DATASET.reports[2]!, gold: [{ quote: 'absent', category: 'LOCATION' }] }],
    };
    const result = await evaluateDetection({ ...base, dataset: broken, split: 'all', runs: 1 });
    expect(result.ok).toBe(false);
  });
});
