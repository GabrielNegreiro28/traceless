/**
 * Remembers on-device inferences that outlived their deadline and are still running.
 *
 * Why: on-device inference cannot be aborted through the SDK, and the shared serial
 * queue stays held until it really ends (see serialQueue.ts). If one hangs, every later
 * call would wait behind it forever. While a timed-out inference is still running, the
 * runners fail fast instead. Share ONE tracker between every runner that shares the queue.
 */
export interface StuckTracker {
  /** True while at least one timed-out inference has not settled yet. */
  isStuck(): boolean;
  /** Marks the tracker stuck until `work` settles (fulfilled or rejected). */
  holdUntilSettled(work: Promise<unknown>): void;
}

export function createStuckTracker(): StuckTracker {
  let running = 0;
  const release = (): void => {
    running -= 1;
  };
  return {
    isStuck: () => running > 0,
    holdUntilSettled(work) {
      running += 1;
      void work.then(release, release);
    },
  };
}
