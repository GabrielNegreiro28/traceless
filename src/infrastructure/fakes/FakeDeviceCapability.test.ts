import { describe, expect, it } from 'vitest';
import { createAppError } from '../../shared/appError';
import { FakeDeviceCapability } from './FakeDeviceCapability';

describe('FakeDeviceCapability', () => {
  it('is available by default and prepares instantly', async () => {
    const fake = new FakeDeviceCapability();
    const progress: number[] = [];
    await expect(fake.check()).resolves.toBe('available');
    await expect(fake.prepare((f) => progress.push(f))).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(progress).toEqual([1]);
    expect(fake.prepareCalls).toBe(1);
  });

  it('becomes available after a successful prepare', async () => {
    const fake = new FakeDeviceCapability({ availability: 'downloadable', progress: [0.5, 1] });
    const progress: number[] = [];
    await expect(fake.check()).resolves.toBe('downloadable');
    await fake.prepare((f) => progress.push(f));
    expect(progress).toEqual([0.5, 1]);
    await expect(fake.check()).resolves.toBe('available');
  });

  it('can fail prepare and stay unavailable', async () => {
    const error = createAppError('OnDeviceUnavailable', { message: 'no model' });
    const fake = new FakeDeviceCapability({ availability: 'unavailable', prepareError: error });
    await expect(fake.prepare(() => undefined)).resolves.toEqual({ ok: false, error });
    await expect(fake.check()).resolves.toBe('unavailable');
  });
});
