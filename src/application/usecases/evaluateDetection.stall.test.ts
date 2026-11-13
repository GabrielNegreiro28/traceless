import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeIdentityScanner } from '../../infrastructure/fakes/FakeIdentityScanner';
import { createAppError } from '../../shared/appError';
import { err } from '../../shared/result';
import type { EvalScan } from './evaluateDetection';
import { respond, runEval } from './evaluateDetection.testKit';
import { scanReport } from './scanReport';

/** Stalled reports in an evaluation (docs/design/fase2-gate-iteration.md §G.2). */

const stuck = (recoverable: boolean) =>
  err(createAppError('OnDeviceStuck', { message: 'stalled', recoverable }));

/** Report `a` stalls (recoverable) in every run; the others scan normally. */
function stallingOnA(recoverable: boolean): EvalScan {
  const scanner = new FakeIdentityScanner({ respond: (c) => respond(c) });
  const clock = new FakeClock(0, 5);
  return (text) =>
    text.includes('night nurse')
      ? Promise.resolve(stuck(recoverable))
      : scanReport(text, { scanner, clock, chunkChars: 3000 });
}

describe('evaluateDetection with on-device stalls', () => {
  it('counts a stalled report as a scan failure and continues with the next report', async () => {
    const result = await runEval(stallingOnA(true), 'all', 2);
    for (const run of result.runs) {
      expect(run.reports.map((r) => [r.reportId, r.ok, r.errorKind])).toEqual([
        ['a', false, 'OnDeviceStuck'],
        ['b', true, null],
        ['c', true, null],
      ]);
    }
    expect(result.summary.pooled.scanFailureRate).toBeCloseTo(2 / 6);
    expect(result.stalls).toEqual({ recovered: 2, terminal: 0 });
  });

  it('counts terminal stalls separately', async () => {
    const result = await runEval(stallingOnA(false), 'all', 1);
    expect(result.stalls).toEqual({ recovered: 0, terminal: 1 });
  });

  it('records zero stalls (JSON-serialisable) when nothing stalls', async () => {
    const failing: EvalScan = () =>
      Promise.resolve(err(createAppError('Offline', { message: 'offline' })));
    const result = await runEval(failing, 'all', 1);
    expect(result.stalls).toEqual({ recovered: 0, terminal: 0 });
    const saved = JSON.parse(JSON.stringify(result)) as { readonly stalls: unknown };
    expect(saved.stalls).toEqual({ recovered: 0, terminal: 0 });
  });
});
