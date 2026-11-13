/** Monotonic time source in milliseconds, injected so durations are testable. */
export interface Clock {
  now(): number;
}
