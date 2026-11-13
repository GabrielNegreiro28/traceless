import { describe, expect, it } from 'vitest';
import { createSerialQueue } from './serialQueue';

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('createSerialQueue', () => {
  it('runs tasks one at a time, in enqueue order, and returns their values', async () => {
    const queue = createSerialQueue();
    const events: string[] = [];
    const gate = deferred();
    const first = queue.enqueue(async () => {
      events.push('start:a');
      await gate.promise;
      events.push('end:a');
      return 'a';
    });
    const second = queue.enqueue(async () => {
      events.push('start:b');
      await Promise.resolve();
      events.push('end:b');
      return 'b';
    });
    await Promise.resolve();
    expect(events).toEqual(['start:a']);
    gate.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual(['a', 'b']);
    expect(events).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
  });

  it('rejects only the failing task and keeps running the next ones', async () => {
    const queue = createSerialQueue();
    const failing = queue.enqueue(() => Promise.reject(new Error('boom')));
    const throwing = queue.enqueue(() => {
      throw new Error('sync boom');
    });
    const next = queue.enqueue(() => Promise.resolve('still runs'));
    await expect(failing).rejects.toThrow('boom');
    await expect(throwing).rejects.toThrow('sync boom');
    await expect(next).resolves.toBe('still runs');
  });

  it('keeps separate queues independent', async () => {
    const gate = deferred();
    const blocked = createSerialQueue();
    void blocked.enqueue(() => gate.promise);
    await expect(createSerialQueue().enqueue(() => Promise.resolve(1))).resolves.toBe(1);
    gate.resolve();
  });
});
