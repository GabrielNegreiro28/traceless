import { buildFindingId } from '../span';
import type { Finding, FindingCategory } from '../types';
import type { Candidate } from './candidateTypes';

/**
 * Layer 3a of the on-device detection cascade: turns the verifier's verdicts on Layer-2
 * candidates into findings. Pure; the span is the candidate's exact span (no quote locating).
 */

/** Who a candidate is about, as the verifier judged it. */
export const DISCLOSURE_SUBJECTS = ['WRITER', 'OTHER', 'UNSURE'] as const;

export type DisclosureSubject = (typeof DISCLOSURE_SUBJECTS)[number];

/** WRITING_STYLE belongs to the style task, never to a verified candidate. */
export type VerifiableCategory = Exclude<FindingCategory, 'WRITING_STYLE'>;

/** The verifier's judgement on candidate `index` (0-based, in the list it was shown). */
export interface CandidateVerdict {
  readonly index: number;
  readonly about: DisclosureSubject;
  readonly category: VerifiableCategory | 'NONE';
}

interface Template {
  readonly reason: string;
  /** A vaguer replacement the reporter can edit in review; null = remove. */
  readonly suggestion: string | null;
}

/** Fixed per-category texts: never derived from report or model text. */
const TEMPLATES: Readonly<Record<VerifiableCategory, Template>> = {
  ROLE_UNIQUE: {
    reason: 'A role or duty that few people have can point to you.',
    suggestion: 'a member of the team',
  },
  SCHEDULE: { reason: 'When you work can narrow down who you are.', suggestion: 'on some shifts' },
  LOCATION: { reason: 'Where you work or were can point to you.', suggestion: 'at work' },
  PERSONAL_EVENT_DATE: {
    reason: 'A date from your own life can identify you.',
    suggestion: 'recently',
  },
  PERSONAL_TRAIT: { reason: 'A personal detail can narrow down who you are.', suggestion: null },
  TEAM_SIZE: { reason: 'The size of your team can narrow down who you are.', suggestion: 'a team' },
  DIRECT_IDENTIFIER: { reason: 'This could identify you directly.', suggestion: null },
};

export function verifiedTemplate(category: VerifiableCategory): Template {
  return TEMPLATES[category];
}

function toFinding(candidate: Candidate, category: VerifiableCategory): Finding {
  const { reason, suggestion } = TEMPLATES[category];
  return {
    id: buildFindingId('MODEL', candidate.span, category),
    span: candidate.span,
    quote: candidate.quote,
    category,
    reason,
    suggestion,
    origin: 'MODEL',
  };
}

/**
 * One MODEL finding per candidate judged about the WRITER with a category other than NONE.
 * Verdicts for an unknown index are ignored; a repeated index keeps its first verdict.
 */
export function verifiedFindings(
  candidates: readonly Candidate[],
  verdicts: readonly CandidateVerdict[],
): Finding[] {
  const seen = new Set<number>();
  const findings: Finding[] = [];
  for (const verdict of verdicts) {
    const candidate = candidates[verdict.index];
    if (candidate === undefined || seen.has(verdict.index)) continue;
    seen.add(verdict.index);
    if (verdict.about !== 'WRITER' || verdict.category === 'NONE') continue;
    findings.push(toFinding(candidate, verdict.category));
  }
  return findings;
}
