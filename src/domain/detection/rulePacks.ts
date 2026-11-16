/**
 * Which deterministic rules run (docs/design/fase2-gate-iteration.md §G.3):
 * - `core`: direct identifiers, explicit dates and the sign-off (detectionRules.ts, signOffRule.ts);
 * - `core+firstPerson`: core plus the first-person rule pack (firstPersonRules.ts).
 */
export const RULE_PACKS = ['core', 'core+firstPerson'] as const;

export type RulePack = (typeof RULE_PACKS)[number];

/** The default of the detector itself; the shipped pipeline and basic checks pass `core+firstPerson`. */
export const DEFAULT_RULE_PACK: RulePack = 'core';

/** Result files saved before §G.3 carry no rule pack: they ran the core rules. */
export function rulePackOrDefault(rulePack: RulePack | undefined): RulePack {
  return rulePack ?? DEFAULT_RULE_PACK;
}
