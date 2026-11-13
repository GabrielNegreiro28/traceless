import { withDeadline } from './deadline';

/**
 * Remembers on-device inferences that outlived their deadline and are still running, and
 * how often this page load has recovered from one (docs/design/fase2-gate-iteration.md §G.2).
 *
 * Why: the shared serial queue stays held until an inference really ends (see
 * serialQueue.ts). If one hangs, every later call would wait behind it forever. While a
 * timed-out inference is still running, the runners fail fast instead. The runner abandons
 * the stalled model (its AbortSignal destroys the Chrome session), which normally makes the
 * hung inference settle at once; `recover` decides whether that worked well enough to try
 * again. Share ONE tracker between every runner that shares the queue.
 */
export interface StuckTracker {
  /**
   * True while at least one timed-out inference has not settled yet, and for good once a
   * stall was terminal (until the page is reloaded).
   */
  isStuck(): boolean;
  /** Marks the tracker stuck until `work` settles (fulfilled or rejected). */
  holdUntilSettled(work: Promise<unknown>): void;
  /**
   * Call after the stalled work's model was abandoned. True when `work` settles within the
   * abort grace and the page load still has recoveries left (this spends one). Otherwise
   * false, and the tracker stays stuck for the rest of the page load (terminal).
   */
  recover(work: Promise<unknown>): Promise<boolean>;
}

/** §G.2: at most this many recoveries per page load; the next stall is terminal. */
export const MAX_RECOVERIES = 2;

/** §G.2: abandoned work still unsettled this long after the abort makes the stall terminal. */
export const ABORT_GRACE_MS = 5_000;

export interface StuckTrackerOptions {
  readonly maxRecoveries?: number;
  readonly abortGraceMs?: number;
}

/** Resolves true once `work` settles (either way), or false after `ms`. */
function settlesWithin(work: Promise<unknown>, ms: number): Promise<boolean> {
  const settled = work.then(
    () => true,
    () => true,
  );
  return withDeadline(settled, ms, () => false);
}

export function createStuckTracker(options: StuckTrackerOptions = {}): StuckTracker {
  const maxRecoveries = options.maxRecoveries ?? MAX_RECOVERIES;
  const abortGraceMs = options.abortGraceMs ?? ABORT_GRACE_MS;
  let running = 0;
  let recoveries = 0;
  let terminal = false;
  const release = (): void => {
    running -= 1;
  };
  return {
    isStuck: () => terminal || running > 0,
    holdUntilSettled(work) {
      running += 1;
      void work.then(release, release);
    },
    async recover(work) {
      const settled = await settlesWithin(work, abortGraceMs);
      if (settled && !terminal && recoveries < maxRecoveries) {
        recoveries += 1;
        return true;
      }
      terminal = true;
      return false;
    },
  };
}
