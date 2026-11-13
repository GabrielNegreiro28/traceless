import { MODEL_FINDING_CATEGORIES, type ModelFindingCategory } from '../schemas/identityScan';
import { STRATEGIES as V1_STRATEGIES } from './identityScan.v1';

/**
 * Every prompt strategy the composition root can run: a list of category groups, one
 * model call per group. A superset of the v1 strategies (kept in identityScan.v1.ts so
 * v1 stays untouched). `single2` runs the full category list twice and unions the
 * findings (docs/design/fase2-gate-iteration.md §C.3).
 */
export const STRATEGIES = {
  ...V1_STRATEGIES,
  single2: [MODEL_FINDING_CATEGORIES, MODEL_FINDING_CATEGORIES],
} as const satisfies Readonly<Record<string, readonly (readonly ModelFindingCategory[])[]>>;

export type StrategyName = keyof typeof STRATEGIES;
