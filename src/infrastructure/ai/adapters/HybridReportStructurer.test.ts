import { AIError, AIErrorCode, InferenceSource } from 'firebase/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { approvedText } from '../../../application/usecases/submitReport.testKit';
import { createAppError } from '../../../shared/appError';
import { err, ok } from '../../../shared/result';
import { HybridReportStructurer, type StructurableModel } from './HybridReportStructurer';

const TEXT = approvedText('A manager approved false invoices at the depot.');
const VALID = JSON.stringify({
  category: 'fraud',
  summary: 'A manager approved false invoices.',
  when: '',
  where: 'at the depot',
});

function modelAnswering(text: string, inferenceSource?: InferenceSource): StructurableModel {
  return {
    generateContent: vi.fn(() =>
      Promise.resolve({
        response: {
          ...(inferenceSource === undefined ? {} : { inferenceSource }),
          text: () => text,
        },
      }),
    ),
  };
}

const structurer = (model: StructurableModel, timeoutMs = 1_000) =>
  new HybridReportStructurer(() => ok(model), timeoutMs);

afterEach(() => {
  vi.useRealTimers();
});

describe('HybridReportStructurer', () => {
  it.each([
    [InferenceSource.ON_DEVICE, 'ON_DEVICE'],
    [InferenceSource.IN_CLOUD, 'IN_CLOUD'],
    [undefined, 'IN_CLOUD'],
  ] as const)('reports inferenceSource %s as %s', async (sdkSource, expected) => {
    const result = await structurer(modelAnswering(VALID, sdkSource)).structure(TEXT);
    expect(result).toEqual({
      ok: true,
      value: {
        report: {
          category: 'fraud',
          summary: 'A manager approved false invoices.',
          when: null,
          where: 'at the depot',
        },
        source: expected,
      },
    });
  });

  it('turns invalid output into InvalidModelOutput', async () => {
    const result = await structurer(modelAnswering('{"category":"theft"}')).structure(TEXT);
    expect(result).toMatchObject({ ok: false, error: { kind: 'InvalidModelOutput' } });
  });

  it('maps an SDK error (for example App Check refused) to an AppError', async () => {
    const model: StructurableModel = {
      generateContent: () =>
        Promise.reject(
          new AIError(AIErrorCode.FETCH_ERROR, 'denied', { status: 403, statusText: 'x' }),
        ),
    };
    const result = await structurer(model).structure(TEXT);
    expect(result).toMatchObject({ ok: false, error: { kind: 'PermissionDenied' } });
  });

  it('returns a model creation failure and creates the model only once', async () => {
    const failing = new HybridReportStructurer(
      () => err(createAppError('Unknown', { message: 'no model' })),
      1_000,
    );
    expect(await failing.structure(TEXT)).toMatchObject({ ok: false, error: { kind: 'Unknown' } });

    const getModel = vi.fn(() => ok(modelAnswering(VALID, InferenceSource.ON_DEVICE)));
    const reused = new HybridReportStructurer(getModel, 1_000);
    await reused.structure(TEXT);
    await reused.structure(TEXT);
    expect(getModel).toHaveBeenCalledTimes(1);
  });

  it('gives up after the deadline (a stuck on-device call never blocks the card)', async () => {
    vi.useFakeTimers();
    const model: StructurableModel = { generateContent: () => new Promise(() => undefined) };
    const pending = structurer(model, 500).structure(TEXT);
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toMatchObject({ ok: false, error: { kind: 'Offline' } });
  });

  it('never puts report text in an error', async () => {
    const result = await structurer(modelAnswering('not json')).structure(TEXT);
    expect(JSON.stringify(result)).not.toContain('invoices');
  });
});
