import { describe, expect, it } from 'vitest';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import {
  FakeIdentityScanner,
  type FakeScanStep,
} from '../../infrastructure/fakes/FakeIdentityScanner';
import type { EvalScan } from './evaluateDetection';
import { mf, runEval as run } from './evaluateDetection.testKit';
import { scanReport } from './scanReport';

const ACCUSED = 'The bursar, Ms. Quennell-Ashby';
const THIRD = 'He moves the money at night';

/** Two test-split reports whose only must-not spans are the people being reported. */
const VIEWS_DATASET: Dataset = {
  version: 'views-v1',
  reports: [
    {
      id: 'p',
      sector: 'club',
      split: 'test',
      text: `${ACCUSED}, pays herself twice. I keep the boathouse keys on weekends.`,
      gold: [{ quote: 'I keep the boathouse keys on weekends', category: 'SCHEDULE' }],
      mustNotFlag: [{ quote: ACCUSED, kind: 'ACCUSED' }],
    },
    {
      id: 'q',
      sector: 'club',
      split: 'test',
      text: `${THIRD}. I am the only rower with a key.`,
      gold: [{ quote: 'the only rower with a key', category: 'ROLE_UNIQUE' }],
      mustNotFlag: [{ quote: THIRD, kind: 'ACCUSED' }],
    },
  ],
};

/** A v2-like model: flags the accused too, but labels the introduction as protected. */
function respond(chunk: string): FakeScanStep {
  if (chunk.includes('boathouse')) {
    return {
      findings: [mf(ACCUSED, 'ROLE_UNIQUE'), mf('I keep the boathouse keys', 'SCHEDULE')],
      protectedQuotes: [ACCUSED],
    };
  }
  return { findings: [mf(THIRD, 'SCHEDULE'), mf('the only rower with a key', 'ROLE_UNIQUE')] };
}

/** scanReport with both post-filters; the n-th scan takes `durations[n]` ms. */
function filteredScan(durations: readonly number[] = [5]): EvalScan {
  const scanner = new FakeIdentityScanner({ respond: (c) => respond(c) });
  let call = 0;
  return (text) => {
    const step = durations[Math.min(call++, durations.length - 1)] ?? 5;
    return scanReport(text, {
      scanner,
      clock: new FakeClock(0, step),
      chunkChars: 3000,
      postFilters: ['protectedMentions', 'thirdPerson'],
    });
  };
}

describe('evaluateDetection raw and filtered views (test split)', () => {
  it('gates on the filtered view; the raw view keeps the model mistakes', async () => {
    const result = await run(filteredScan(), 'test', 1, undefined, VIEWS_DATASET);
    expect(result.gate).toBe(result.views.filtered.gate);
    expect(result.summary).toBe(result.views.filtered.summary);
    expect(result.views.filtered.summary.pooled['violation:ACCUSED']).toBe(0);
    expect(result.views.raw.summary.pooled['violation:ACCUSED']).toBe(1);
    expect(result.views.filtered.gate?.accusedBand).toBe('PASS');
    expect(result.views.raw.gate?.accusedBand).toBe('FAIL');
    expect(result.views.raw.gate).not.toEqual(result.views.filtered.gate);
  });

  it('records each view per report, so the filtered findings are a subset', async () => {
    const result = await run(filteredScan(), 'test', 1, undefined, VIEWS_DATASET);
    const raw = result.views.raw.runs[0]?.reports ?? [];
    const filtered = result.views.filtered.runs[0]?.reports ?? [];
    expect(raw.map((r) => r.findings.length)).toEqual([2, 2]);
    expect(filtered.map((r) => r.findings.length)).toEqual([1, 1]);
  });

  it('keeps the JSON free of report and quote text in both views', async () => {
    const json = JSON.stringify(await run(filteredScan(), 'test', 1, undefined, VIEWS_DATASET));
    for (const text of ['Quennell', 'bursar', 'boathouse', 'rower', 'money']) {
      expect(json).not.toContain(text);
    }
  });

  it('pools latency over every scan of both runs (median of all, not mean of medians)', async () => {
    const result = await run(filteredScan([10, 10, 100, 100]), 'test', 2, undefined, VIEWS_DATASET);
    for (const view of [result.views.filtered, result.views.raw]) {
      expect(view.runs.map((r) => r.metrics.latencyP50Ms)).toEqual([10, 100]);
      expect(view.summary.pooled.latencyP50Ms).toBe(10);
      expect(view.summary.metrics.latencyP50Ms?.mean).toBe(55);
      expect(view.summary.pooled.latencyMaxMs).toBe(100);
    }
  });
});
