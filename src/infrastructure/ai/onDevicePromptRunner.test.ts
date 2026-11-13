import { InferenceSource } from 'firebase/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeviceAvailability } from '../../application/ports/DeviceCapability';
import { toRawText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import {
  createOnDevicePromptRunner,
  type OnDevicePromptRunnerDeps,
  type PromptableModel,
} from './onDevicePromptRunner';
import { createSerialQueue } from './serialQueue';
import { createStuckTracker } from './stuckTracker';

const PROMPT = toRawText('Report:\n"""\nI am the only night nurse.\n"""');
const MODEL_TEXT = '{"findings":[]}';

interface Answer {
  readonly source?: InferenceSource | undefined;
  readonly text?: string;
  readonly gate?: Promise<void>;
  readonly error?: Error;
}

/** Scripted model with a start/end log; `text()` is a spy so tests can prove it was never read. */
function fakeModel(answers: readonly Answer[]) {
  const events: string[] = [];
  const prompts: string[] = [];
  const text = vi.fn((value: string) => value);
  const model: PromptableModel = {
    async generateContent(prompt) {
      const index = prompts.length;
      prompts.push(prompt);
      events.push(`start:${index}`);
      const answer = answers[index] ?? {};
      await (answer.gate ?? Promise.resolve());
      events.push(`end:${index}`);
      if (answer.error !== undefined) throw answer.error;
      const source = 'source' in answer ? answer.source : InferenceSource.ON_DEVICE;
      const readText = () => text(answer.text ?? MODEL_TEXT);
      return {
        response:
          source === undefined ? { text: readText } : { inferenceSource: source, text: readText },
      };
    },
  };
  return { model, events, prompts, text };
}

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setup(
  model: PromptableModel,
  options: {
    availability?: DeviceAvailability;
    getModel?: () => Result<PromptableModel, AppError>;
  } = {},
  timeoutMs?: number,
) {
  const check = vi.fn(() => Promise.resolve(options.availability ?? 'available'));
  const getModel = vi.fn(options.getModel ?? (() => ok(model)));
  const deps: OnDevicePromptRunnerDeps = {
    queue: createSerialQueue(),
    stuck: createStuckTracker(),
    capability: { check },
    getModel,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
  return { runner: createOnDevicePromptRunner(deps), check, getModel };
}

describe('createOnDevicePromptRunner', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  describe('deadline and a hung inference', () => {
    const STUCK = {
      kind: 'OnDeviceStuck',
      message: 'On-device AI is not responding. Reload the page to try again.',
    };

    it('answers OnDeviceStuck at the deadline, with a fixed message only', async () => {
      vi.useFakeTimers();
      const gate = deferred();
      const fake = fakeModel([{ gate: gate.promise }]);
      const { runner } = setup(fake.model, {}, 1000);
      const first = runner.run(PROMPT);
      await vi.advanceTimersByTimeAsync(1000);
      await expect(first).resolves.toEqual(err(STUCK));
      gate.resolve();
    });

    it('fails later calls fast while the timed-out inference still runs', async () => {
      vi.useFakeTimers();
      const gate = deferred();
      const fake = fakeModel([{ gate: gate.promise }, {}]);
      const { runner, check, getModel } = setup(fake.model, {}, 1000);
      void runner.run(PROMPT);
      await vi.advanceTimersByTimeAsync(1000);
      check.mockClear();
      getModel.mockClear();
      await expect(runner.run(PROMPT)).resolves.toEqual(err(STUCK));
      expect(check).not.toHaveBeenCalled();
      expect(getModel).not.toHaveBeenCalled();
      expect(fake.events).toEqual(['start:0']);
      gate.resolve();
    });

    it('holds the queue until the hung inference ends, then runs normally again', async () => {
      vi.useFakeTimers();
      const gate = deferred();
      const fake = fakeModel([{ gate: gate.promise }, {}]);
      const { runner } = setup(fake.model, {}, 1000);
      void runner.run(PROMPT);
      await vi.advanceTimersByTimeAsync(1000);
      gate.resolve();
      await vi.waitFor(() => expect(fake.events).toEqual(['start:0', 'end:0']));
      await expect(runner.run(PROMPT)).resolves.toEqual(
        ok({ text: MODEL_TEXT, source: 'ON_DEVICE' }),
      );
      expect(fake.events).toEqual(['start:0', 'end:0', 'start:1', 'end:1']);
    });

    it('clears the stuck state when the hung inference fails', async () => {
      vi.useFakeTimers();
      const gate = deferred();
      const fake = fakeModel([{ gate: gate.promise, error: new Error('late failure') }, {}]);
      const { runner } = setup(fake.model, {}, 1000);
      void runner.run(PROMPT);
      await vi.advanceTimersByTimeAsync(1000);
      gate.resolve();
      await vi.waitFor(() => expect(fake.events).toEqual(['start:0', 'end:0']));
      const after = await runner.run(PROMPT);
      expect(after.ok).toBe(true);
    });

    it('fails fast on every runner that shares the stuck tracker', async () => {
      vi.useFakeTimers();
      const gate = deferred();
      const a = fakeModel([{ gate: gate.promise }]);
      const b = fakeModel([{}]);
      const shared = { queue: createSerialQueue(), stuck: createStuckTracker() };
      const capability = { check: () => Promise.resolve<DeviceAvailability>('available') };
      const runA = createOnDevicePromptRunner({
        ...shared,
        capability,
        getModel: () => ok(a.model),
        timeoutMs: 1000,
      });
      const runB = createOnDevicePromptRunner({
        ...shared,
        capability,
        getModel: () => ok(b.model),
      });
      void runA.run(PROMPT);
      await vi.advanceTimersByTimeAsync(1000);
      await expect(runB.run(PROMPT)).resolves.toEqual(err(STUCK));
      expect(b.events).toEqual([]);
      gate.resolve();
    });

    it('does not mark anything stuck when the inference beats the deadline', async () => {
      vi.useFakeTimers();
      const fake = fakeModel([{}, {}]);
      const { runner } = setup(fake.model, {}, 1000);
      await expect(runner.run(PROMPT)).resolves.toEqual(
        ok({ text: MODEL_TEXT, source: 'ON_DEVICE' }),
      );
      await vi.advanceTimersByTimeAsync(5000);
      await expect(runner.run(PROMPT)).resolves.toEqual(
        ok({ text: MODEL_TEXT, source: 'ON_DEVICE' }),
      );
    });
  });
});
