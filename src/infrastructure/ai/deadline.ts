/**
 * Settles with `work`, or with `onTimeout()` if `work` takes longer than `ms`.
 * It does NOT cancel `work` (on-device inference cannot be aborted through the SDK);
 * callers that hold a lock must still await `work` before releasing it.
 */
export function withDeadline<T>(work: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout()), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}
