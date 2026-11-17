// Pure helpers for scripts/eval-bootstrap.mjs: per-report bootstrap CIs over the tallies
// stored in an evaluation result file. Mirrors src/domain/evaluation/summary.ts: pooled
// metrics are ratios of sums; strict recall counts failed scans as missed (strictHit / goldAll).

export interface BootstrapTally {
  readonly strictHit: number;
  readonly goldAll: number;
  readonly accusedFlagged: number;
  readonly accusedTotal: number;
}

export interface Interval {
  readonly point: number | null;
  readonly low: number | null;
  readonly high: number | null;
}

interface StoredCounts {
  readonly strictHit: number;
  readonly goldAll: number;
  readonly mustNot: { readonly ACCUSED: { readonly flagged: number; readonly total: number } };
}

export interface StoredResult {
  readonly runs: readonly {
    readonly reports: readonly { readonly reportId: string; readonly counts: StoredCounts }[];
  }[];
}

/** Deterministic PRNG (mulberry32) so the same seed always gives the same resamples. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One tally per report id, summed over the runs (the unit that is resampled). */
export function tallyByReport(result: StoredResult): BootstrapTally[] {
  const byId = new Map<string, BootstrapTally>();
  for (const run of result.runs) {
    for (const report of run.reports) {
      const prev = byId.get(report.reportId);
      const c = report.counts;
      byId.set(report.reportId, {
        strictHit: (prev?.strictHit ?? 0) + c.strictHit,
        goldAll: (prev?.goldAll ?? 0) + c.goldAll,
        accusedFlagged: (prev?.accusedFlagged ?? 0) + c.mustNot.ACCUSED.flagged,
        accusedTotal: (prev?.accusedTotal ?? 0) + c.mustNot.ACCUSED.total,
      });
    }
  }
  return [...byId.values()];
}

function ratio(n: number, d: number): number | null {
  return d === 0 ? null : n / d;
}

function sumTallies(tallies: readonly BootstrapTally[]): BootstrapTally {
  return tallies.reduce(
    (acc, t) => ({
      strictHit: acc.strictHit + t.strictHit,
      goldAll: acc.goldAll + t.goldAll,
      accusedFlagged: acc.accusedFlagged + t.accusedFlagged,
      accusedTotal: acc.accusedTotal + t.accusedTotal,
    }),
    { strictHit: 0, goldAll: 0, accusedFlagged: 0, accusedTotal: 0 },
  );
}

function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)));
  return sorted[index] as number;
}

function interval(point: number | null, samples: number[]): Interval {
  const sorted = [...samples].sort((a, b) => a - b);
  return { point, low: quantile(sorted, 0.025), high: quantile(sorted, 0.975) };
}

/** Percentile bootstrap, resampling reports with replacement. */
export function bootstrapIntervals(
  tallies: readonly BootstrapTally[],
  resamples: number,
  seed: number,
): { strictRecall: Interval; accusedViolation: Interval } {
  const random = mulberry32(seed);
  const total = sumTallies(tallies);
  const recalls: number[] = [];
  const accused: number[] = [];
  for (let i = 0; i < resamples; i += 1) {
    const draw: BootstrapTally[] = [];
    for (let j = 0; j < tallies.length; j += 1) {
      draw.push(tallies[Math.floor(random() * tallies.length)] as BootstrapTally);
    }
    const s = sumTallies(draw);
    const r = ratio(s.strictHit, s.goldAll);
    const a = ratio(s.accusedFlagged, s.accusedTotal);
    if (r !== null) recalls.push(r);
    if (a !== null) accused.push(a);
  }
  return {
    strictRecall: interval(ratio(total.strictHit, total.goldAll), recalls),
    accusedViolation: interval(ratio(total.accusedFlagged, total.accusedTotal), accused),
  };
}
