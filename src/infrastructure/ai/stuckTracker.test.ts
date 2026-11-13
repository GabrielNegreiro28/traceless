import { afterEach, describe, expect, it, vi } from 'vitest';
import { ABORT_GRACE_MS, createStuckTracker, MAX_RECOVERIES } from './stuckTracker';

function deferred() {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createStuckTracker', () => {
  it('starts not stuck', () => {
    expect(createStuckTracker().isStuck()).toBe(false);
  });

  it('is stuck until the held work fulfills', async () => {
    const tracker = createStuckTracker();
    const work = deferred();
    tracker.holdUntilSettled(work.promise);
    expect(tracker.isStuck()).toBe(true);
    work.resolve();
    await work.promise;
    await Promise.resolve();
    expect(tracker.isStuck()).toBe(false);
  });

  it('is released when the held work rejects', async () => {
    const tracker = createStuckTracker();
    const work = deferred();
    tracker.holdUntilSettled(work.promise);
    work.reject(new Error('boom'));
    await work.promise.catch(() => undefined);
    await Promise.resolve();
    expect(tracker.isStuck()).toBe(false);
  });

  it('stays stuck while any of several held works is still running', async () => {
    const tracker = createStuckTracker();
    const first = deferred();
    const second = deferred();
    tracker.holdUntilSettled(first.promise);
    tracker.holdUntilSettled(second.promise);
    first.resolve();
    await first.promise;
    await Promise.resolve();
    expect(tracker.isStuck()).toBe(true);
    second.resolve();
    await second.promise;
    await Promise.resolve();
    expect(tracker.isStuck()).toBe(false);
  });
});

describe('StuckTracker.recover (§G.2 stuck recovery)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is recoverable when the abandoned work settles, at most twice per page load', async () => {
    const tracker = createStuckTracker();
    expect(await tracker.recover(Promise.resolve())).toBe(true);
    expect(await tracker.recover(Promise.reject(new Error('aborted')))).toBe(true);
    expect(tracker.isStuck()).toBe(false);
    expect(await tracker.recover(Promise.resolve())).toBe(false);
    expect(tracker.isStuck()).toBe(true);
  });

  it('honours a custom cap', async () => {
    const tracker = createStuckTracker({ maxRecoveries: 0 });
    expect(await tracker.recover(Promise.resolve())).toBe(false);
  });

  it('is terminal when the work is still unsettled 5 s after the abort, and stays stuck', async () => {
    vi.useFakeTimers();
    const tracker = createStuckTracker();
    const work = deferred();
    tracker.holdUntilSettled(work.promise);
    let answer: boolean | null = null;
    void tracker.recover(work.promise).then((value) => {
      answer = value;
    });
    await vi.advanceTimersByTimeAsync(ABORT_GRACE_MS - 1);
    expect(answer).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(answer).toBe(false);

    work.resolve();
    await work.promise;
    await Promise.resolve();
    expect(tracker.isStuck()).toBe(true);
    expect(await tracker.recover(Promise.resolve())).toBe(false);
  });

  it('releases the hold before answering, so a recoverable answer means the queue is free', async () => {
    const tracker = createStuckTracker();
    const work = deferred();
    tracker.holdUntilSettled(work.promise);
    const answer = tracker.recover(work.promise);
    work.resolve();
    expect(await answer).toBe(true);
    expect(tracker.isStuck()).toBe(false);
  });

  it('exports the pre-registered limits', () => {
    expect(MAX_RECOVERIES).toBe(2);
    expect(ABORT_GRACE_MS).toBe(5_000);
  });
});
