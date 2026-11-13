import type { RiskLevel } from '../domain/risk/riskScorer';

/** "Risk: high"; the text is the real signal, the colored segments only reinforce it. */
export function riskText(level: RiskLevel): string {
  return `Risk: ${level.toLowerCase()}`;
}
