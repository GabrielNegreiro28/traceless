import { AIError, AIErrorCode } from 'firebase/ai';
import { describe, expect, it, vi } from 'vitest';
import { createDeviceCapability, type DeviceModel } from './deviceCapability';

function withAvailability(availability: () => Promise<unknown>) {
  const spy = vi.fn(availability);
  return {
    spy,
    capability: createDeviceCapability({ globalObject: { LanguageModel: { availability: spy } } }),
  };
}

describe('createDeviceCapability().check', () => {
  it('reads unavailable when the Prompt API global is missing', async () => {
    await expect(createDeviceCapability({ globalObject: {} }).check()).resolves.toBe('unavailable');
  });

  it.each(['available', 'downloadable', 'downloading', 'unavailable'])(
    'passes through %s',
    async (value) => {
      const { capability } = withAvailability(() => Promise.resolve(value));
      await expect(capability.check()).resolves.toBe(value);
    },
  );

  it('asks with exactly the text-only English options the models use', async () => {
    const { spy, capability } = withAvailability(() => Promise.resolve('available'));
    await capability.check();
    expect(spy).toHaveBeenCalledWith({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
  });

  it('reads unavailable for an unknown answer or a thrown error', async () => {
    await expect(withAvailability(() => Promise.resolve('maybe')).capability.check()).resolves.toBe(
      'unavailable',
    );
    await expect(
      withAvailability(() =>
        Promise.reject(new DOMException('x', 'NotSupportedError')),
      ).capability.check(),
    ).resolves.toBe('unavailable');
  });

  it('uses globalThis by default (jsdom has no Prompt API)', async () => {
    await expect(createDeviceCapability().check()).resolves.toBe('unavailable');
  });
});

describe('createDeviceCapability().prepare', () => {
  function fakeModel(initialize: DeviceModel['initializeDeviceModel']): DeviceModel {
    return { initializeDeviceModel: vi.fn(initialize) };
  }

  it('initializes the model through the SDK and reports clamped progress', async () => {
    const model = fakeModel((onProgress) => {
      for (const value of [-0.5, 0.25, 1, 7, Number.NaN]) onProgress?.(value);
      return Promise.resolve();
    });
    const progress: number[] = [];
    const result = await createDeviceCapability({ globalObject: {} }).prepare(model, (f) =>
      progress.push(f),
    );
    expect(result).toEqual({ ok: true, value: undefined });
    expect(model.initializeDeviceModel).toHaveBeenCalledTimes(1);
    expect(progress).toEqual([0, 0.25, 1, 1, 0]);
  });

  it('maps an SDK failure to an AppError', async () => {
    const model = fakeModel(() =>
      Promise.reject(new AIError(AIErrorCode.API_NOT_ENABLED, 'not available')),
    );
    const result = await createDeviceCapability().prepare(model, () => undefined);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe('OnDeviceUnavailable');
  });
});
