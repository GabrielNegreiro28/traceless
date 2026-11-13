import type { RawText } from '../text/brandedText';
import { DETECTION_RULES, type DetectionRule } from './detectionRules';
import { buildFindingId } from './span';
import type { Finding } from './types';

function matchRule(text: string, rule: DetectionRule): Finding[] {
  const regex = new RegExp(rule.pattern, rule.flags);
  return Array.from(text.matchAll(regex), (m) => {
    const span = { start: m.index, end: m.index + m[0].length };
    return {
      id: buildFindingId('RULE', span, rule.category),
      span,
      quote: m[0],
      category: rule.category,
      reason: rule.reason,
      suggestion: rule.suggestion,
      origin: 'RULE' as const,
    };
  });
}

/**
 * Deterministic detection of direct identifiers and explicit dates.
 * Known limitation: "In May 12 people quit" is read as the date "May 12".
 */
export function detectByRules(text: RawText): Finding[] {
  const byId = new Map<string, Finding>();
  for (const rule of DETECTION_RULES) {
    for (const finding of matchRule(text, rule)) {
      if (!byId.has(finding.id)) byId.set(finding.id, finding);
    }
  }
  return [...byId.values()].sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);
}
