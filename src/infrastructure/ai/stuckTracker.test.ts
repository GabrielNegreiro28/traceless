import { describe, expect, it } from 'vitest';
import { createStuckTracker } from './stuckTracker';

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
