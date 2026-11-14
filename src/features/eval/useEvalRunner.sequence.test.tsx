import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EvalRunResult, EvalScan } from '../../application/usecases/evaluateDetection';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import { EMPTY_SCAN, fakeServices } from './evalTestKit';
import { EVAL_VARIANTS, type EvalVariant } from './evalVariants';
import { useEvalRunner } from './useEvalRunner';

// Exactly two registered matrix variants, so the matrix order is easy to follow.
vi.mock('./evalVariants', async (importOriginal) => {
  const actual = await importOriginal<{ EVAL_VARIANTS: readonly EvalVariant[] }>();
  const first = actual.EVAL_VARIANTS[0]!;
  const variants: readonly EvalVariant[] = [
    first,
    { ...first, id: 'second', strategy: 'grouped2' },
  ];
  return {
    ...actual,
    EVAL_VARIANTS: variants,
    MATRIX_VARIANT_IDS: variants.map((v) => v.id),
    findVariant: (id: string) => variants.find((v) => v.id === id),
  };
});

type SaveResult = Result<string, AppError>;

describe('useEvalRunner variant sequencing', () => {
  it("starts the second variant's scans only after the first variant was saved", async () => {
    const events: string[] = [];
    let releaseFirstSave: () => void = () => undefined;
    const scanFor = vi.fn((variant: EvalVariant) => {
      events.push(`scanFor:${variant.id}`);
      return EMPTY_SCAN;
    });
    const saveResult = vi.fn((result: EvalRunResult): Promise<SaveResult> => {
      events.push(`save:${result.variant.id}`);
      if (result.variant.id === 'second') return Promise.resolve(ok('second.json'));
      return new Promise((resolve) => {
        releaseFirstSave = () => resolve(ok('first.json'));
      });
    });
    const { result } = renderHook(() => useEvalRunner(fakeServices({ scanFor, saveResult })));
    const [first] = EVAL_VARIANTS;

    act(() => result.current.start('devMatrix', first!));

    await waitFor(() => expect(saveResult).toHaveBeenCalledTimes(1));
    expect(events).toEqual([`scanFor:${first!.id}`, `save:${first!.id}`]);
    expect(result.current.state.phase).toBe('running');

    act(() => releaseFirstSave());

    await waitFor(() => expect(result.current.state.phase).toBe('done'));
    expect(events).toEqual([
      `scanFor:${first!.id}`,
      `save:${first!.id}`,
      'scanFor:second',
      'save:second',
    ]);
  });

  it('a stalled report is a scan failure; the matrix continues to the next report and variant', async () => {
    const stalled = createAppError('OnDeviceStuck', { message: 'stalled', recoverable: true });
    let scans = 0;
    const firstScanStalls: EvalScan = (text) => {
      scans += 1;
      return scans === 1 ? Promise.resolve(err(stalled)) : EMPTY_SCAN(text);
    };
    const scanFor = vi.fn((variant: EvalVariant) =>
      variant.id === 'second' ? EMPTY_SCAN : firstScanStalls,
    );
    const { result } = renderHook(() => useEvalRunner(fakeServices({ scanFor })));

    act(() => result.current.start('devMatrix', EVAL_VARIANTS[0]!));

    await waitFor(() => expect(result.current.state.phase).toBe('done'));
    const { state } = result.current;
    if (state.phase !== 'done') throw new Error('expected done');
    const [first, second] = state.outcomes.map((o) => o.result);
    expect(first?.runs[0]?.reports.map((r) => [r.ok, r.errorKind])).toEqual([
      [false, 'OnDeviceStuck'],
      [true, null],
    ]);
    expect(first?.stalls).toEqual({ recovered: 1, terminal: 0 });
    expect(second?.stalls).toEqual({ recovered: 0, terminal: 0 });
    expect(scanFor).toHaveBeenCalledTimes(2);
  });
});
