import { AIError, AIErrorCode } from 'firebase/ai';

/**
 * Bounded retry for TRANSIENT cloud failures (HTTP 5xx: internal, unavailable, deadline
 * exceeded on the server side). Permission, App Check, quota, safety and malformed-output
 * errors are never retried: another try cannot fix them. The classification reads the raw
 * SDK exception, before cloudErrorMapper turns it into an AppError.
 */

export interface TransientRetryOptions {
  /** One delay per retry, in ms (its length is the retry budget). */
  readonly delaysMs: readonly number[];
  readonly sleep: (ms: number) => Promise<void>;
}

/** At most two retries, with a short backoff. */
export const DEFAULT_TRANSIENT_RETRY: TransientRetryOptions = {
  delaysMs: [600, 1_500],
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** 500 internal, 502 bad gateway, 503 unavailable, 504 deadline exceeded. */
const TRANSIENT_STATUSES: readonly number[] = [500, 502, 503, 504];

export function isTransientCloudFailure(error: unknown): boolean {
  if (!(error instanceof AIError) || error.code !== AIErrorCode.FETCH_ERROR) return false;
  const status = error.customErrorData?.status;
  return status !== undefined && TRANSIENT_STATUSES.includes(status);
}

const NEVER_CANCELLED = (): boolean => false;

/**
 * Runs `call`, retrying it after each delay while it throws a transient failure. Rethrows the
 * last error when the budget is spent, the failure is not transient, or the caller cancelled
 * (checked before every retry, so a cancelled caller makes no further cloud call).
 */
export async function retryTransient<T>(
  call: () => Promise<T>,
  options: TransientRetryOptions = DEFAULT_TRANSIENT_RETRY,
  isCancelled: () => boolean = NEVER_CANCELLED,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      const delay = options.delaysMs[attempt];
      if (delay === undefined || !isTransientCloudFailure(error) || isCancelled()) throw error;
      await options.sleep(delay);
      if (isCancelled()) throw error;
    }
  }
}
