import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withDeadline } from './deadline';

describe('withDeadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('settles with the work when it finishes in time and clears its timer', async () => {
    const result = withDeadline(Promise.resolve('done'), 1000, () => 'late');
    await expect(result).resolves.toBe('done');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles with onTimeout() when the work is slower, without cancelling it', async () => {
    let finish: (value: string) => void = () => undefined;
    const work = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const result = withDeadline(work, 1000, () => 'late');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe('late');
    finish('done');
    await expect(work).resolves.toBe('done');
  });
});
