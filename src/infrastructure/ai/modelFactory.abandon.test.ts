import type { AI, HybridParams } from 'firebase/ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOnDeviceModel, type OnDeviceModelSpec } from './modelFactory';

/** OnDeviceModel.abandon (docs/design/fase2-gate-iteration.md §G.2), SDK boundary mocked. */

const sdk = vi.hoisted(() => ({ getGenerativeModel: vi.fn() }));

vi.mock('firebase/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getGenerativeModel: sdk.getGenerativeModel,
}));

const SPEC: OnDeviceModelSpec = {
  task: 'identityScan',
  groupKey: 'v2:ALL',
  initialPrompts: [],
  responseConstraint: { type: 'object' },
};

function fakeAi(): AI {
  return { app: {}, location: 'test' } as unknown as AI;
}

/** The abort signal the factory put in `createOptions` of the n-th getGenerativeModel call. */
function signalOf(call: number): AbortSignal {
  const params = sdk.getGenerativeModel.mock.calls[call]?.[1] as HybridParams | undefined;
  const signal = params?.onDeviceParams?.createOptions?.signal;
  if (signal === undefined) throw new Error('expected an abort signal');
  return signal;
}

function model(ai: AI) {
  const result = createOnDeviceModel(ai, SPEC);
  if (!result.ok) throw new Error('expected a model');
  return result.value;
}

describe('createOnDeviceModel: abandon', () => {
  beforeEach(() => {
    sdk.getGenerativeModel.mockImplementation(() => ({
      generateContent: vi.fn(),
      initializeDeviceModel: vi.fn(),
    }));
    vi.stubGlobal('LanguageModel', { availability: () => Promise.resolve('available') });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gives every model its own, not yet aborted, signal in createOptions', () => {
    model(fakeAi());
    model(fakeAi());
    expect(signalOf(0)).toBeInstanceOf(AbortSignal);
    expect(signalOf(0)).not.toBe(signalOf(1));
    expect(signalOf(0).aborted).toBe(false);
  });

  it('aborts the signal and forgets the model; the next call builds a fresh one', () => {
    const ai = fakeAi();
    const first = model(ai);
    expect(model(ai)).toBe(first);
    first.abandon();
    expect(signalOf(0).aborted).toBe(true);

    const second = model(ai);
    expect(second).not.toBe(first);
    expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(2);
    expect(signalOf(1).aborted).toBe(false);
    const params = sdk.getGenerativeModel.mock.calls[1]?.[1] as HybridParams;
    expect(params.mode).toBe('only_on_device');
    expect(sdk.getGenerativeModel.mock.calls[1]?.[2]).toEqual({
      baseUrl: 'https://on-device-only.invalid',
    });
  });

  it('rebuilds through the layer 1 guard: no Prompt API, no new model', () => {
    const ai = fakeAi();
    model(ai).abandon();
    vi.unstubAllGlobals();
    const again = createOnDeviceModel(ai, SPEC);
    expect(!again.ok && again.error.kind).toBe('OnDeviceUnavailable');
    expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(1);
  });

  it('is idempotent and never evicts a newer model', () => {
    const ai = fakeAi();
    const first = model(ai);
    first.abandon();
    const second = model(ai);
    first.abandon();
    expect(model(ai)).toBe(second);
    expect(signalOf(1).aborted).toBe(false);
  });
});
