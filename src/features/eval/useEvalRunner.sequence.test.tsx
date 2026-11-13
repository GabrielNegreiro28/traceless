import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EvalRunResult } from '../../application/usecases/evaluateDetection';
import type { AppError } from '../../shared/appError';
import { ok, type Result } from '../../shared/result';
import { EMPTY_SCAN, fakeServices } from './evalTestKit';
import { EVAL_VARIANTS, type EvalVariant } from './evalVariants';
import { useEvalRunner } from './useEvalRunner';

// Exactly two registered variants, so the matrix order is easy to follow.
vi.mock('./evalVariants', async (importOriginal) => {
  const actual = await importOriginal<{ EVAL_VARIANTS: readonly EvalVariant[] }>();
  const first = actual.EVAL_VARIANTS[0]!;
  return { ...actual, EVAL_VARIANTS: [first, { ...first, id: 'second', strategy: 'grouped2' }] };
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
});
