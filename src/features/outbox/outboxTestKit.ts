import { detectByRules } from '../../domain/detection/ruleDetector';
import type { Finding } from '../../domain/detection/types';
import type { ReviewChoice } from '../../domain/rewrite/reviewDecision';
import { findingOf } from '../../domain/rewrite/rewriteTestKit';
import { scoreRisk } from '../../domain/risk/riskScorer';
import { toRawText } from '../../domain/text/brandedText';
import { reportFlowReducer, type FlowState, type OutboxState } from '../review/reportFlowMachine';

/** Outbox fixtures built through the real reducer (test only). */
export const OUTBOX_TEXT = toRawText(
  'I am the only night lead at Dock B. Email me at me@home.org.',
);
export const LEAD = findingOf(OUTBOX_TEXT, 'the only night lead', {
  category: 'ROLE_UNIQUE',
  suggestion: 'a staff member',
});
export const DOCK = findingOf(OUTBOX_TEXT, 'Dock B', { suggestion: 'the site' });
export const EMAIL = detectByRules(OUTBOX_TEXT)[0] as Finding;
export const OUTBOX_FINDINGS = [LEAD, DOCK, EMAIL];

export function outboxOf(choices: readonly (readonly [Finding, ReviewChoice])[]): OutboxState {
  let state: FlowState = {
    status: 'reviewing',
    text: OUTBOX_TEXT,
    checks: 'full',
    findings: OUTBOX_FINDINGS,
    protectedSpans: [],
    decisions: [],
    risk: scoreRisk(OUTBOX_FINDINGS),
  };
  for (const [finding, choice] of choices) {
    state = reportFlowReducer(state, { type: 'DECIDE', findingId: finding.id, choice });
  }
  state = reportFlowReducer(state, { type: 'CONFIRM_SECOND_LOOK', confirmed: true });
  state = reportFlowReducer(state, { type: 'OPEN_OUTBOX' });
  if (state.status !== 'outbox') throw new Error('fixture did not reach the outbox');
  return state;
}

const ACCEPT: ReviewChoice = { action: 'ACCEPTED' };
const KEEP: ReviewChoice = { action: 'KEPT_RISK' };

export const SCENARIOS: readonly (readonly [string, OutboxState])[] = [
  [
    'everything accepted',
    outboxOf([
      [LEAD, ACCEPT],
      [DOCK, ACCEPT],
      [EMAIL, ACCEPT],
    ]),
  ],
  [
    'location left pending',
    outboxOf([
      [LEAD, ACCEPT],
      [EMAIL, ACCEPT],
    ]),
  ],
  [
    'role and location kept',
    outboxOf([
      [LEAD, KEEP],
      [DOCK, KEEP],
      [EMAIL, ACCEPT],
    ]),
  ],
  [
    'email kept',
    outboxOf([
      [LEAD, ACCEPT],
      [DOCK, ACCEPT],
      [EMAIL, KEEP],
    ]),
  ],
];
