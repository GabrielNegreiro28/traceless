import { InferenceSource } from 'firebase/ai';
import { describe, expect, it, vi } from 'vitest';
import type { DeviceAvailability } from '../../application/ports/DeviceCapability';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok } from '../../shared/result';
import { createOnDevicePromptRunner } from './onDevicePromptRunner';
import { deferred, fakeModel, PROMPT, setup } from './onDevicePromptRunner.testKit';
import { createSerialQueue } from './serialQueue';
import { createStuckTracker } from './stuckTracker';

// Deadline and stall recovery: onDevicePromptRunner.stall.test.ts.

describe('createOnDevicePromptRunner', () => {
  it('returns the on-device text and sends the prompt unchanged', async () => {
    const fake = fakeModel([{ text: '{"findings":[1]}' }]);
    const { runner } = setup(fake.model);
    await expect(runner.run(PROMPT)).resolves.toEqual(
      ok({ text: '{"findings":[1]}', source: 'ON_DEVICE' }),
    );
    expect(fake.prompts).toEqual([PROMPT]);
  });

  describe('layer 3: post-check of the inference source', () => {
    it.each([
      ['in_cloud', InferenceSource.IN_CLOUD],
      ['missing', undefined],
      ['the upper-case name', 'ON_DEVICE' as InferenceSource],
    ])('discards a result whose source is %s, without reading its text', async (_, source) => {
      const fake = fakeModel([{ source, text: 'I am the only night nurse.' }]);
      const { runner } = setup(fake.model);
      const result = await runner.run(PROMPT);
      if (result.ok) throw new Error('expected a PrivacyViolation');
      expect(result.error.kind).toBe('PrivacyViolation');
      expect(result.error.message).not.toContain('night nurse');
      expect(Object.keys(result.error).sort()).toEqual(['kind', 'message']);
      expect(fake.text).not.toHaveBeenCalled();
    });
  });

  describe('availability gate', () => {
    it.each<[DeviceAvailability, AppError['kind']]>([
      ['downloadable', 'OnDeviceUnavailable'],
      ['downloading', 'ModelDownloading'],
      ['unavailable', 'OnDeviceUnavailable'],
    ])(
      'with %s, fails with %s without creating or calling the model',
      async (availability, kind) => {
        const fake = fakeModel([]);
        const { runner, getModel } = setup(fake.model, { availability });
        const result = await runner.run(PROMPT);
        expect(!result.ok && result.error.kind).toBe(kind);
        expect(getModel).not.toHaveBeenCalled();
        expect(fake.prompts).toEqual([]);
      },
    );

    it('checks availability before every call', async () => {
      const { runner, check } = setup(fakeModel([]).model);
      await runner.run(PROMPT);
      await runner.run(PROMPT);
      expect(check).toHaveBeenCalledTimes(2);
    });
  });

  it('returns the model factory error without calling generateContent', async () => {
    const refused = createAppError('OnDeviceUnavailable', { message: 'no Prompt API' });
    const fake = fakeModel([]);
    const { runner } = setup(fake.model, { getModel: () => err(refused) });
    await expect(runner.run(PROMPT)).resolves.toEqual(err(refused));
    expect(fake.prompts).toEqual([]);
  });

  it('maps a thrown model error to an AppError', async () => {
    const fake = fakeModel([{ error: new DOMException('unsupported', 'NotSupportedError') }]);
    const { runner } = setup(fake.model);
    const result = await runner.run(PROMPT);
    expect(!result.ok && result.error.kind).toBe('LanguageNotSupported');
  });

  it('runs two overlapping calls strictly one after another', async () => {
    const gate = deferred();
    const fake = fakeModel([{ gate: gate.promise }, {}]);
    const { runner } = setup(fake.model);
    const first = runner.run(PROMPT);
    const second = runner.run(PROMPT);
    await vi.waitFor(() => expect(fake.events).toEqual(['start:0']));
    gate.resolve();
    await Promise.all([first, second]);
    expect(fake.events).toEqual(['start:0', 'end:0', 'start:1', 'end:1']);
  });

  it('shares the queue across runners (one on-device session at a time)', async () => {
    const gate = deferred();
    const a = fakeModel([{ gate: gate.promise }]);
    const b = fakeModel([{}]);
    const shared = { queue: createSerialQueue(), stuck: createStuckTracker() };
    const capability = { check: () => Promise.resolve<DeviceAvailability>('available') };
    const runA = createOnDevicePromptRunner({ ...shared, capability, getModel: () => ok(a.model) });
    const runB = createOnDevicePromptRunner({ ...shared, capability, getModel: () => ok(b.model) });
    const first = runA.run(PROMPT);
    const second = runB.run(PROMPT);
    await vi.waitFor(() => expect(a.events).toEqual(['start:0']));
    expect(b.events).toEqual([]);
    gate.resolve();
    await Promise.all([first, second]);
    expect(b.events).toEqual(['start:0', 'end:0']);
  });
});
