import type { Clock } from '../../application/ports/Clock';

/** Deterministic clock: every `now()` call advances time by `stepMs`. */
export class FakeClock implements Clock {
  private current: number;
  private readonly stepMs: number;

  constructor(startMs = 0, stepMs = 0) {
    this.current = startMs;
    this.stepMs = stepMs;
  }

  now(): number {
    const value = this.current;
    this.current += this.stepMs;
    return value;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}
