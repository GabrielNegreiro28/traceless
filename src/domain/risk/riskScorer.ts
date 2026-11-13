import { FINDING_CATEGORIES, type Finding, type FindingCategory } from '../detection/types';

export type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskDriver {
  readonly category: FindingCategory;
  readonly count: number;
  /** Contribution of this category to the combined score, in (0, 1]. */
  readonly weight: number;
}

export interface RiskAssessment {
  readonly level: RiskLevel;
  /** Combined re-identification risk in [0, 1]. */
  readonly score: number;
  readonly categories: readonly FindingCategory[];
  readonly explanation: string;
  readonly drivers: readonly RiskDriver[];
}

/** Base anonymity loss of one detail of each category (1.0 = identifies on its own). */
export const CATEGORY_WEIGHTS: Readonly<Record<FindingCategory, number>> = {
  DIRECT_IDENTIFIER: 1.0,
  ROLE_UNIQUE: 0.6,
  PERSONAL_EVENT_DATE: 0.45,
  SCHEDULE: 0.35,
  LOCATION: 0.35,
  TEAM_SIZE: 0.3,
  PERSONAL_TRAIT: 0.3,
  WRITING_STYLE: 0.15,
};

export const RISK_THRESHOLDS = { high: 0.75, medium: 0.45 } as const;

/** Each repeat of a category adds this share of its weight, for at most `MAX_EXTRA_REPEATS`. */
const REPEAT_BONUS = 0.1;
const MAX_EXTRA_REPEATS = 2;

const CATEGORY_LABELS: Readonly<Record<FindingCategory, string>> = {
  DIRECT_IDENTIFIER: 'direct identifier',
  ROLE_UNIQUE: 'unique role',
  PERSONAL_EVENT_DATE: 'personal date',
  SCHEDULE: 'schedule',
  LOCATION: 'location',
  TEAM_SIZE: 'team size',
  PERSONAL_TRAIT: 'personal trait',
  WRITING_STYLE: 'writing style',
};

function groupByCategory(findings: readonly Finding[]): Map<FindingCategory, number> {
  const counts = new Map<FindingCategory, number>();
  for (const finding of findings) {
    counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1);
  }
  return counts;
}

/** Base weight plus a small, bounded bonus for repeats; never above 1. */
function categoryContribution(category: FindingCategory, count: number): number {
  const extras = Math.min(Math.max(count - 1, 0), MAX_EXTRA_REPEATS);
  return Math.min(1, CATEGORY_WEIGHTS[category] * (1 + REPEAT_BONUS * extras));
}

/** score = 1 - product(1 - w_i): independent details compound instead of adding up. */
function combine(weights: readonly number[]): number {
  return 1 - weights.reduce((remaining, w) => remaining * (1 - w), 1);
}

function levelFor(score: number, hasDirectIdentifier: boolean): RiskLevel {
  if (hasDirectIdentifier || score >= RISK_THRESHOLDS.high) return 'HIGH';
  if (score >= RISK_THRESHOLDS.medium) return 'MEDIUM';
  return 'LOW';
}

function explain(drivers: readonly RiskDriver[]): string {
  const total = drivers.reduce((sum, d) => sum + d.count, 0);
  const parts = drivers.map((d) => {
    const label = CATEGORY_LABELS[d.category];
    return d.count > 1 ? `${label} ×${d.count}` : label;
  });
  const noun = total === 1 ? 'detail' : 'details';
  const joiner = drivers.length > 1 ? ' combined' : '';
  return `${total} identifying ${noun}${joiner}: ${parts.join(' + ')}`;
}

/**
 * Deterministic re-identification risk of a set of findings.
 *
 * k-anonymity intuition: every quasi-identifier (role, schedule, location, ...) shrinks
 * the pool of people who could have written the report. The shrinkage multiplies, so the
 * remaining anonymity is the product of (1 - weight) and the risk is 1 minus that
 * product. Combining details therefore raises risk super-additively relative to the
 * strongest single detail. A direct identifier is HIGH regardless of the score.
 */
export function scoreRisk(findings: readonly Finding[]): RiskAssessment {
  const counts = groupByCategory(findings);
  const categories = FINDING_CATEGORIES.filter((c) => counts.has(c));
  if (categories.length === 0) {
    return {
      level: 'NONE',
      score: 0,
      categories: [],
      explanation: 'No identifying details found',
      drivers: [],
    };
  }
  const drivers = categories.map((category) => {
    const count = counts.get(category) ?? 0;
    return { category, count, weight: categoryContribution(category, count) };
  });
  const score = combine(drivers.map((d) => d.weight));
  const level = levelFor(score, counts.has('DIRECT_IDENTIFIER'));
  return { level, score, categories, explanation: explain(drivers), drivers };
}
