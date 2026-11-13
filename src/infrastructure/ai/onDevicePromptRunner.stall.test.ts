import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceAvailability } from '../../application/ports/DeviceCapability';
import { err, ok } from '../../shared/result';
import { createOnDevicePromptRunner } from './onDevicePromptRunner';
import {
  deferred,
  fakeModel,
  memoizedModels,
  MODEL_TEXT,
  PROMPT,
  setup,
} from './onDevicePromptRunner.testKit';
import { createSerialQueue } from './serialQueue';
import { createStuckTracker } from './stuckTracker';

/** Deadline and stuck recovery (docs/design/fase2-gate-iteration.md §G.2). */

const TIMEOUT_MS = 1000;
const GRACE_MS = 5000;
const ON_DEVICE = ok({ text: MODEL_TEXT, source: 'ON_DEVICE' });
const STUCK_RECOVERABLE = err({
  kind: 'OnDeviceStuck',
  message: 'On-device AI stalled; its model was abandoned and the next call starts a fresh one.',
  recoverable: true,
});
const STUCK_TERMINAL = err({
  kind: 'OnDeviceStuck',
  message: 'On-device AI is not responding. Reload the page to try again.',
  recoverable: false,
});

/** Never resolves: a hung on-device inference. */
const HANG = { gate: new Promise<void>(() => undefined) };

/** True once `promise` has settled (checked without waiting). */
function tracked(promise: Promise<unknown>): () => boolean {
  let settled = false;
  void promise.finally(() => {
    settled = true;
  });
  return () => settled;
}

describe('on-device runner: deadline and stuck recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('timeout: abandons the model, answers recoverable, and the next run uses a NEW model', async () => {
    const models = memoizedModels([[HANG], [{}]], { abortSettles: true });
    const { runner } = setup(fakeModel([]).model, { getModel: models.getModel }, TIMEOUT_MS);

    const first = runner.run(PROMPT);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await expect(first).resolves.toEqual(STUCK_RECOVERABLE);
    expect(models.built[0]?.abandon).toHaveBeenCalledOnce();

    await expect(runner.run(PROMPT)).resolves.toEqual(ON_DEVICE);
    expect(models.built).toHaveLength(2);
    expect(models.built[1]?.prompts).toEqual([PROMPT]);
    expect(models.built[1]?.abandon).not.toHaveBeenCalled();
  });

  it('spends at most two recoveries per page load; the third stall is terminal for good', async () => {
    const models = memoizedModels([[HANG], [HANG], [HANG], [{}]], { abortSettles: true });
    const { runner, check, getModel } = setup(
      fakeModel([]).model,
      { getModel: models.getModel },
      TIMEOUT_MS,
    );
    for (const expected of [STUCK_RECOVERABLE, STUCK_RECOVERABLE, STUCK_TERMINAL]) {
      const run = runner.run(PROMPT);
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
      await expect(run).resolves.toEqual(expected);
    }
    expect(models.built.every((m) => m.abandon.mock.calls.length === 1)).toBe(true);

    check.mockClear();
    getModel.mockClear();
    await expect(runner.run(PROMPT)).resolves.toEqual(STUCK_TERMINAL);
    expect(check).not.toHaveBeenCalled();
    expect(getModel).not.toHaveBeenCalled();
  });

  it('an abort that never settles is terminal 5 s after the abort, and stays terminal', async () => {
    const gate = deferred();
    const fake = fakeModel([{ gate: gate.promise }, {}]);
    const { runner, getModel } = setup(fake.model, {}, TIMEOUT_MS);

    const first = runner.run(PROMPT);
    const settled = tracked(first);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    expect(fake.abandon).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(GRACE_MS - 1);
    expect(settled()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(first).resolves.toEqual(STUCK_TERMINAL);

    gate.resolve();
    await vi.waitFor(() => expect(fake.events).toEqual(['start:0', 'end:0']));
    getModel.mockClear();
    await expect(runner.run(PROMPT)).resolves.toEqual(STUCK_TERMINAL);
    expect(getModel).not.toHaveBeenCalled();
  });

  it('a hang before any model exists (availability check) is terminal: nothing to abandon', async () => {
    const fake = fakeModel([{}]);
    const { runner, check, getModel } = setup(fake.model, {}, TIMEOUT_MS);
    check.mockReturnValueOnce(new Promise<DeviceAvailability>(() => undefined));
    const first = runner.run(PROMPT);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + GRACE_MS);
    await expect(first).resolves.toEqual(STUCK_TERMINAL);
    expect(getModel).not.toHaveBeenCalled();
    expect(fake.abandon).not.toHaveBeenCalled();
  });

  it('fails later calls fast while the abandoned inference has not settled yet', async () => {
    const gate = deferred();
    const fake = fakeModel([{ gate: gate.promise }, {}]);
    const { runner, check, getModel } = setup(fake.model, {}, TIMEOUT_MS);
    void runner.run(PROMPT);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    check.mockClear();
    getModel.mockClear();
    await expect(runner.run(PROMPT)).resolves.toEqual(STUCK_TERMINAL);
    expect(check).not.toHaveBeenCalled();
    expect(getModel).not.toHaveBeenCalled();
    expect(fake.events).toEqual(['start:0']);
    gate.resolve();
  });

  it('frees the queue once the abandoned inference settles within the grace', async () => {
    const gate = deferred();
    const fake = fakeModel([{ gate: gate.promise }, {}]);
    const { runner } = setup(fake.model, {}, TIMEOUT_MS);
    const first = runner.run(PROMPT);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 2000);
    gate.resolve();
    await expect(first).resolves.toEqual(STUCK_RECOVERABLE);
    await expect(runner.run(PROMPT)).resolves.toEqual(ON_DEVICE);
    expect(fake.events).toEqual(['start:0', 'end:0', 'start:1', 'end:1']);
  });

  it('a hung inference that later fails within the grace is still recoverable', async () => {
    const gate = deferred();
    const fake = fakeModel([{ gate: gate.promise, error: new Error('late failure') }, {}]);
    const { runner } = setup(fake.model, {}, TIMEOUT_MS);
    const first = runner.run(PROMPT);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    gate.resolve();
    await expect(first).resolves.toEqual(STUCK_RECOVERABLE);
    expect((await runner.run(PROMPT)).ok).toBe(true);
  });

  it('fails fast on every runner that shares the stuck tracker', async () => {
    const gate = deferred();
    const a = fakeModel([{ gate: gate.promise }]);
    const b = fakeModel([{}]);
    const shared = { queue: createSerialQueue(), stuck: createStuckTracker() };
    const capability = { check: () => Promise.resolve<DeviceAvailability>('available') };
    const runA = createOnDevicePromptRunner({
      ...shared,
      capability,
      getModel: () => ok(a.model),
      timeoutMs: TIMEOUT_MS,
    });
    const runB = createOnDevicePromptRunner({ ...shared, capability, getModel: () => ok(b.model) });
    void runA.run(PROMPT);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await expect(runB.run(PROMPT)).resolves.toEqual(STUCK_TERMINAL);
    expect(b.events).toEqual([]);
    gate.resolve();
  });

  it('does nothing when the inference beats the deadline', async () => {
    const fake = fakeModel([{}, {}]);
    const { runner } = setup(fake.model, {}, TIMEOUT_MS);
    await expect(runner.run(PROMPT)).resolves.toEqual(ON_DEVICE);
    await vi.advanceTimersByTimeAsync(GRACE_MS * 2);
    await expect(runner.run(PROMPT)).resolves.toEqual(ON_DEVICE);
    expect(fake.abandon).not.toHaveBeenCalled();
  });
});
