import type { Clock } from '../../application/ports/Clock';

/** Monotonic wall clock for real durations (unaffected by system time changes). */
export const systemClock: Clock = {
  now: () => performance.now(),
};
