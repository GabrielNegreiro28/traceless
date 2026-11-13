import { detectByRules } from '../detection/ruleDetector';
import { spanContains, spansOverlap } from '../detection/span';
import type { Finding, TextSpan } from '../detection/types';
import { isDecided, type ReviewDecision } from '../rewrite/reviewDecision';
import type { RawText } from '../text/brandedText';
import { changedSpans } from './reviewState';

export interface DirectIdentifierStatus {
  /** Direct identifiers that block approval (pending, mangled by a partial edit, or new). */
  readonly undecided: number;
  /** Direct identifiers still in the text that the reporter kept knowingly (KEPT_RISK). */
  readonly keptAtRisk: number;
}

type IdentifierStatus = 'REWRITTEN' | 'MANGLED' | 'PENDING' | 'KEPT_RISK' | 'NOT_ABOUT_ME';

interface ReviewContext {
  readonly findings: readonly Finding[];
  readonly decisions: ReadonlyMap<string, ReviewDecision>;
  readonly changed: readonly TextSpan[];
}

interface ClassifiedIdentifier {
  readonly identifier: Finding;
  readonly status: IdentifierStatus;
}

function directRules(text: RawText): Finding[] {
  return detectByRules(text).filter((f) => f.category === 'DIRECT_IDENTIFIER');
}

/**
 * The keep decision covering an identifier: only a decided finding whose span CONTAINS
 * the identifier (the rule finding at that exact span included). KEPT_RISK wins over
 * NOT_ABOUT_ME when both apply (the safer reading).
 */
function keepStatus(identifier: Finding, context: ReviewContext): IdentifierStatus | null {
  const actions = context.findings
    .filter((f) => spanContains(f.span, identifier.span))
    .map((f) => context.decisions.get(f.id))
    .filter(isDecided)
    .map((d) => d?.action);
  if (actions.includes('KEPT_RISK')) return 'KEPT_RISK';
  return actions.includes('NOT_ABOUT_ME') ? 'NOT_ABOUT_ME' : null;
}

/** Rewritten away, mangled by a partial change, kept on purpose, or still pending. */
function classify(identifier: Finding, context: ReviewContext): IdentifierStatus {
  const { span } = identifier;
  if (context.changed.some((c) => spanContains(c, span))) return 'REWRITTEN';
  if (context.changed.some((c) => spansOverlap(c, span))) return 'MANGLED';
  return keepStatus(identifier, context) ?? 'PENDING';
}

/** Final identifiers left over after matching, by exact quote, one for one, to `allowed`. */
function countUnmatched(finalIdentifiers: readonly Finding[], allowed: readonly string[]): number {
  const allowance = new Map<string, number>();
  for (const quote of allowed) allowance.set(quote, (allowance.get(quote) ?? 0) + 1);
  let unmatched = 0;
  for (const { quote } of finalIdentifiers) {
    const left = allowance.get(quote) ?? 0;
    if (left > 0) allowance.set(quote, left - 1);
    else unmatched++;
  }
  return unmatched;
}

/** Model direct identifiers still pending and in the text, not already counted by a rule. */
function pendingModelIdentifiers(context: ReviewContext, counted: readonly Finding[]): number {
  return context.findings.filter(
    (f) =>
      f.origin === 'MODEL' &&
      f.category === 'DIRECT_IDENTIFIER' &&
      !isDecided(context.decisions.get(f.id)) &&
      !context.changed.some((c) => spanContains(c, f.span)) &&
      !counted.some((rule) => spansOverlap(rule.span, f.span)),
  ).length;
}

/**
 * Decides which direct identifiers block approval.
 *
 * Each rule-detected identifier of the ORIGINAL text is REWRITTEN (inside an
 * ACCEPTED/EDITED span), MANGLED (only partly changed: blocks), kept (a KEPT_RISK or
 * NOT_ABOUT_ME finding contains it: allowed, the accused's email can be evidence) or
 * PENDING (blocks). The rules then re-run on the FINAL text; final identifiers that do
 * not match, by exact quote, a kept or pending original one are new (typed into an edit)
 * and block too. Pending MODEL direct-identifier findings block as well.
 */
export function assessDirectIdentifiers(
  originalText: RawText,
  finalText: RawText,
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
): DirectIdentifierStatus {
  const context: ReviewContext = {
    findings,
    decisions: new Map(decisions.map((d) => [d.findingId, d])),
    changed: changedSpans(findings, decisions),
  };
  const classified: ClassifiedIdentifier[] = directRules(originalText).map((identifier) => ({
    identifier,
    status: classify(identifier, context),
  }));
  const withStatus = (...s: IdentifierStatus[]) =>
    classified.filter((c) => s.includes(c.status)).map((c) => c.identifier);
  const blocking = withStatus('PENDING', 'MANGLED');
  const allowed = withStatus('PENDING', 'KEPT_RISK', 'NOT_ABOUT_ME').map((f) => f.quote);
  const fresh = countUnmatched(directRules(finalText), allowed);
  const undecided = blocking.length + fresh + pendingModelIdentifiers(context, blocking);
  return { undecided, keptAtRisk: withStatus('KEPT_RISK').length };
}
