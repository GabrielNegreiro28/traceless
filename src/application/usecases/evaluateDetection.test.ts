import { describe, expect, it } from 'vitest';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import type { ModelFinding } from '../../domain/detection/types';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import {
  FakeIdentityScanner,
  type FakeScanStep,
} from '../../infrastructure/fakes/FakeIdentityScanner';
import { createAppError } from '../../shared/appError';
import { ok } from '../../shared/result';
import type { IdentityScanner } from '../ports/IdentityScanner';
import {
  evaluateDetection,
  type EvalProgress,
  type EvalRunResult,
  type EvalScan,
} from './evaluateDetection';
import { scanReport } from './scanReport';

const DATASET: Dataset = {
  version: 'test-v1',
  reports: [
    {
      id: 'a',
      sector: 'health',
      split: 'dev',
      text: 'I am the only night nurse. Mail me at jane@example.com. Dr Smith took the drugs.',
      gold: [
        { quote: 'only night nurse', category: 'ROLE_UNIQUE' },
        { quote: 'jane@example.com', category: 'DIRECT_IDENTIFIER' },
      ],
      mustNotFlag: [{ quote: 'Dr Smith', kind: 'ACCUSED' }],
    },
    {
      id: 'b',
      sector: 'finance',
      split: 'test',
      text: 'I sit at desk 14. Contact bob@corp.com please. The invoice was for big money.',
      gold: [
        { quote: 'desk 14', category: 'LOCATION' },
        { quote: 'bob@corp.com', category: 'DIRECT_IDENTIFIER' },
      ],
      mustNotFlag: [{ quote: 'big money', kind: 'INCIDENT_FACT' }],
    },
    {
      id: 'c',
      sector: 'retail',
      split: 'test',
      text: 'Nothing here points to me at all.',
      gold: [],
      mustNotFlag: [{ quote: 'Nothing here', kind: 'INCIDENT_FACT' }],
    },
  ],
};

const mf = (quote: string, category: ModelFinding['category']): ModelFinding => ({
  quote,
  category,
  reason: 'r',
  suggestion: null,
});

function wrap(scanner: IdentityScanner, clock = new FakeClock(0, 5)): EvalScan {
  return (text) => scanReport(text, { scanner, clock, chunkChars: 3000 });
}

function respond(chunk: string): FakeScanStep {
  if (chunk.includes('night nurse')) {
    return {
      findings: [mf('only night nurse', 'ROLE_UNIQUE'), mf('Dr Smith', 'DIRECT_IDENTIFIER')],
    };
  }
  if (chunk.includes('desk 14'))
    return { findings: [mf('desk 14', 'LOCATION'), mf('ghost', 'LOCATION')] };
  return { findings: [] };
}

async function run(
  scan: EvalScan,
  split: 'dev' | 'test' | 'all',
  runs = 1,
  progress?: EvalProgress[],
) {
  const result = await evaluateDetection({
    dataset: DATASET,
    split,
    scan,
    clock: new FakeClock(1000),
    runs,
    variant: { ...VARIANT, id: 'v-test', promptVersion: 'p-test' },
    ...(progress ? { onProgress: (p: EvalProgress) => progress.push(p) } : {}),
  });
  if (!result.ok) throw new Error('evaluation failed');
  return result.value;
}

const VARIANT = {
  id: 'v',
  promptVersion: 'p',
  strategy: 'single',
  chunkChars: 3000,
  postFilters: [],
} as const;

describe('evaluateDetection with a fake model', () => {
  it('runs the split sequentially and summarises exact metrics', async () => {
    const scanner = new FakeIdentityScanner({ respond: (c) => respond(c) });
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
    const result = await run(wrap(new FakeIdentityScanner({ respond: (c) => respond(c) })), 'test');
    expect(result.runs[0]?.reports.map((r) => r.reportId)).toEqual(['b', 'c']);
    const json = JSON.stringify(result);
    expect(JSON.parse(json)).toEqual(result);
    expect(json).not.toContain('jane@example.com');
    expect(json).not.toContain('desk 14');
  });

  it('fails the gate on the test split when there is no ACCUSED data', async () => {
    const result: EvalRunResult = await run(
      wrap(new FakeIdentityScanner({ respond: (c) => respond(c) })),
      'test',
    );
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
      return wrap(new FakeIdentityScanner({ respond: (c) => respond(c) }))(text);
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
    const result = await evaluateDetection({
      dataset: datedDataset(mode),
      split: 'test',
      scan: swallowing(),
      clock: new FakeClock(),
      runs: 1,
      variant: VARIANT,
    });
    if (!result.ok) throw new Error('evaluation failed');
    return result.value.runs[0]?.metrics;
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

describe('evaluateDetection rules-only baseline', () => {
  it('is deterministic with a scanner that finds nothing', async () => {
    const first = await run(wrap(new FakeIdentityScanner()), 'all');
    const second = await run(wrap(new FakeIdentityScanner()), 'all');
    expect(second).toEqual(first);
    const metrics = first.runs[0]?.metrics;
    expect(metrics?.combinedRecall).toBe(2 / 4);
    expect(metrics?.modelOnlyRecall).toBe(0);
    expect(metrics?.['recall:DIRECT_IDENTIFIER']).toBe(1);
    expect(metrics?.['recall:ROLE_UNIQUE']).toBe(0);
    expect(metrics?.['violation:ACCUSED']).toBe(0);
    expect(metrics?.hallucinatedQuoteRate).toBeNull();
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

describe('evaluateDetection raw and filtered views', () => {
  it('computes each view from its own findings of the same scan', async () => {
    const scan: EvalScan = async (text) => {
      const base = await wrap(new FakeIdentityScanner({ respond: (c) => respond(c) }))(text);
      if (!base.ok) return base;
      return ok({ ...base.value, filtered: { findings: [], modelFindings: [] } });
    };
    const result = await run(scan, 'all');
    const raw = result.views.raw.summary.pooled;
    const filtered = result.views.filtered.summary.pooled;
    expect(result.summary.pooled).toEqual(filtered);
    expect(raw.softPrecision).not.toBe(filtered.softPrecision);
    expect(raw.latencyP50Ms).toBe(filtered.latencyP50Ms);
  });
});
