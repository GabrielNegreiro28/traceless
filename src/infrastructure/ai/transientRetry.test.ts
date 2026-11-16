import { AIError, AIErrorCode } from 'firebase/ai';
import { describe, expect, it, vi } from 'vitest';
import {
  isTransientCloudFailure,
  retryTransient,
  type TransientRetryOptions,
} from './transientRetry';

const fetchError = (status: number) =>
  new AIError(AIErrorCode.FETCH_ERROR, 'Error fetching', { status, statusText: 'x' });

function instantRetry(): TransientRetryOptions & { readonly slept: number[] } {
  const slept: number[] = [];
  return {
    delaysMs: [600, 1_500],
    sleep: (ms) => {
      slept.push(ms);
      return Promise.resolve();
    },
    slept,
  };
}

/** A call that throws the given errors in order, then resolves 'done'. */
function failingThen(...errors: Error[]) {
  return vi.fn(() => {
    const next = errors.shift();
    return next === undefined ? Promise.resolve('done') : Promise.reject(next);
  });
}

describe('isTransientCloudFailure', () => {
  it.each([500, 502, 503, 504])('treats HTTP %d as transient', (status) => {
    expect(isTransientCloudFailure(fetchError(status))).toBe(true);
  });

  it.each([400, 401, 403, 404, 429])('never treats HTTP %d as transient', (status) => {
    expect(isTransientCloudFailure(fetchError(status))).toBe(false);
  });

  it('never treats safety, malformed output or other errors as transient', () => {
    expect(isTransientCloudFailure(new AIError(AIErrorCode.RESPONSE_ERROR, 'x'))).toBe(false);
    expect(isTransientCloudFailure(new AIError(AIErrorCode.API_NOT_ENABLED, 'x'))).toBe(false);
    expect(isTransientCloudFailure(new TypeError('Failed to fetch'))).toBe(false);
    expect(isTransientCloudFailure('boom')).toBe(false);
  });
});

describe('retryTransient', () => {
  it('retries a single HTTP 500 after the first backoff and returns the answer', async () => {
    const retry = instantRetry();
    const call = failingThen(fetchError(500));
    await expect(retryTransient(call, retry)).resolves.toBe('done');
    expect(call).toHaveBeenCalledTimes(2);
    expect(retry.slept).toEqual([600]);
  });

  it('gives up after two retries and rethrows the last error', async () => {
    const retry = instantRetry();
    const last = fetchError(503);
    const call = failingThen(fetchError(500), fetchError(502), last);
    await expect(retryTransient(call, retry)).rejects.toBe(last);
    expect(call).toHaveBeenCalledTimes(3);
    expect(retry.slept).toEqual([600, 1_500]);
  });

  it.each([401, 403, 429])('never retries HTTP %d', async (status) => {
    const retry = instantRetry();
    const call = failingThen(fetchError(status));
    await expect(retryTransient(call, retry)).rejects.toBeInstanceOf(AIError);
    expect(call).toHaveBeenCalledTimes(1);
    expect(retry.slept).toEqual([]);
  });

  it('makes no further call once the caller cancelled during the backoff', async () => {
    let cancelled = false;
    const retry: TransientRetryOptions = {
      delaysMs: [600, 1_500],
      sleep: () => {
        cancelled = true;
        return Promise.resolve();
      },
    };
    const call = failingThen(fetchError(500));
    await expect(retryTransient(call, retry, () => cancelled)).rejects.toBeInstanceOf(AIError);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('does not wait at all when already cancelled', async () => {
    const retry = instantRetry();
    const call = failingThen(fetchError(500));
    await expect(retryTransient(call, retry, () => true)).rejects.toBeInstanceOf(AIError);
    expect(retry.slept).toEqual([]);
  });
});
