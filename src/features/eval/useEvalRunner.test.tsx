import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EvalScan } from '../../application/usecases/evaluateDetection';
import { createAppError } from '../../shared/appError';
import { err, ok } from '../../shared/result';
import type { EvalServices } from './evalServices';
import { EMPTY_SCAN, fakeServices } from './evalTestKit';
import { DEFAULT_EVAL_VARIANT, MATRIX_VARIANT_IDS, type EvalVariant } from './evalVariants';
import { useEvalRunner } from './useEvalRunner';

describe('useEvalRunner', () => {
  const VARIANT = DEFAULT_EVAL_VARIANT;
  const OTHER: EvalVariant = { ...VARIANT, id: 'other', strategy: 'grouped2' };

  it('passes the chosen variant to scanFor and records it in the result', async () => {
    const scanFor = vi.fn(() => EMPTY_SCAN);
    const { result } = renderHook(() => useEvalRunner(fakeServices({ scanFor })));

    act(() => result.current.start('smoke', OTHER));

    await waitFor(() => expect(result.current.state.phase).toBe('done'));
    expect(scanFor).toHaveBeenCalledWith(OTHER);
    const state = result.current.state;
    const outcome = state.phase === 'done' ? state.outcomes[0] : undefined;
    expect(outcome?.result.variant).toEqual(OTHER);
    expect(outcome?.result.strategy).toBe('grouped2');
  });

  it('runs the pinned matrix variants, in order, for the matrix preset', async () => {
    const scanFor = vi.fn<EvalServices['scanFor']>(() => EMPTY_SCAN);
    const saveResult = vi.fn(() => Promise.resolve(ok('f.json')));
    const { result } = renderHook(() => useEvalRunner(fakeServices({ scanFor, saveResult })));

    act(() => result.current.start('devMatrix', OTHER));

    await waitFor(() => expect(result.current.state.phase).toBe('done'));
    expect(scanFor.mock.calls.map(([v]) => v.id)).toEqual(MATRIX_VARIANT_IDS);
    expect(saveResult).toHaveBeenCalledTimes(MATRIX_VARIANT_IDS.length);
    const state = result.current.state;
    expect(state.phase === 'done' && state.outcomes).toHaveLength(MATRIX_VARIANT_IDS.length);
  });

  it('runs exactly the two round-2 variants, dev x 3, whatever is selected', async () => {
    const scanFor = vi.fn<EvalServices['scanFor']>(() => EMPTY_SCAN);
    const { result } = renderHook(() => useEvalRunner(fakeServices({ scanFor })));

    act(() => result.current.start('round2', OTHER));

    await waitFor(() => expect(result.current.state.phase).toBe('done'));
    expect(scanFor.mock.calls.map(([v]) => [v.id, v.rulePack])).toEqual([
      ['v2-single2-rules', 'core+firstPerson'],
      ['v2-single3-rules', 'core+firstPerson'],
    ]);
    const state = result.current.state;
    const outcomes = state.phase === 'done' ? state.outcomes : [];
    expect(outcomes.map((o) => [o.result.split, o.result.runs.length])).toEqual([
      ['dev', 3],
      ['dev', 3],
    ]);
    expect(outcomes.map((o) => o.result.variant.rulePack)).toEqual([
      'core+firstPerson',
      'core+firstPerson',
    ]);
  });

  it('ignores a second start() while a run is in progress', async () => {
    let release: () => void = () => undefined;
    const scan: EvalScan = (text) =>
      new Promise((resolve) => {
        release = () => resolve(EMPTY_SCAN(text));
      });
    const scanFor = vi.fn(() => scan);
    const { result } = renderHook(() => useEvalRunner(fakeServices({ scanFor })));

    act(() => result.current.start('smoke', VARIANT));
    act(() => result.current.start('dev', VARIANT));

    expect(scanFor).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe('running');
    release();
    await waitFor(() => expect(result.current.state.phase).toBe('done'));
  });

  it('reports a failed save without losing the result', async () => {
    const error = createAppError('Unknown', { message: 'down' });
    const services = fakeServices({ saveResult: () => Promise.resolve(err(error)) });
    const { result } = renderHook(() => useEvalRunner(services));

    act(() => result.current.start('smoke', VARIANT));

    await waitFor(() => expect(result.current.state.phase).toBe('done'));
    const state = result.current.state;
    expect(state.phase === 'done' && state.outcomes[0]?.save.kind).toBe('failed');
  });
});
