import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EvalScan } from '../../application/usecases/evaluateDetection';
import { createAppError } from '../../shared/appError';
import { err } from '../../shared/result';
import { EMPTY_SCAN, fakeServices } from './evalTestKit';
import { useEvalRunner } from './useEvalRunner';

describe('useEvalRunner', () => {
  it('passes the chosen strategy to scanFor and records it in the result', async () => {
    const scanFor = vi.fn(() => EMPTY_SCAN);
    const { result } = renderHook(() => useEvalRunner(fakeServices({ scanFor })));

    act(() => result.current.start('smoke', 'grouped2'));

    await waitFor(() => expect(result.current.state.phase).toBe('done'));
    expect(scanFor).toHaveBeenCalledWith('grouped2');
    const state = result.current.state;
    expect(state.phase === 'done' && state.result.strategy).toBe('grouped2');
  });

  it('ignores a second start() while a run is in progress', async () => {
    let release: () => void = () => undefined;
    const scan: EvalScan = (text) =>
      new Promise((resolve) => {
        release = () => resolve(EMPTY_SCAN(text));
      });
    const scanFor = vi.fn(() => scan);
    const { result } = renderHook(() => useEvalRunner(fakeServices({ scanFor })));

    act(() => result.current.start('smoke', 'single'));
    act(() => result.current.start('dev', 'single'));

    expect(scanFor).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe('running');
    release();
    await waitFor(() => expect(result.current.state.phase).toBe('done'));
  });

  it('reports a failed save without losing the result', async () => {
    const error = createAppError('Unknown', { message: 'down' });
    const services = fakeServices({ saveResult: () => Promise.resolve(err(error)) });
    const { result } = renderHook(() => useEvalRunner(services));

    act(() => result.current.start('smoke', 'single'));

    await waitFor(() => expect(result.current.state.phase).toBe('done'));
    const state = result.current.state;
    expect(state.phase === 'done' && state.save.kind).toBe('failed');
  });
});
