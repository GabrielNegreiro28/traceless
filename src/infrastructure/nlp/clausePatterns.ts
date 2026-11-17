import type { RawCandidate } from '../../domain/detection/candidates/candidateTypes';
import { isWriterClause } from './clauses';
import type { Sentence } from './taggedTokens';
import { temporalClause } from './temporalClause';
import { timePlacePhrases } from './timePlacePhrases';
import { firstPersonClause, relativeContinuation, writerObjectClause } from './writerClauses';

/** Patterns of a clause about the writer. */
function writerClauseCandidates(text: string, clause: Sentence): RawCandidate[] {
  return [
    ...temporalClause(text, clause),
    ...firstPersonClause(text, clause),
    ...writerObjectClause(text, clause),
    ...timePlacePhrases(clause),
  ];
}

/**
 * Patterns of a clause that is not about the writer but leans on a neighbouring writer
 * clause: a relative clause right after one ("…, which is just four people") or an opening
 * time/place phrase right before one ("In the spring, I was asked…").
 */
function neighbourCandidates(clause: Sentence, prevIsWriter: boolean, nextIsWriter: boolean) {
  return [
    ...(prevIsWriter ? relativeContinuation(clause) : []),
    ...(nextIsWriter ? timePlacePhrases(clause) : []),
  ];
}

/** Clause-level candidates of one sentence's clauses (third person and quotes skipped). */
export function clauseCandidates(text: string, clauses: readonly Sentence[]): RawCandidate[] {
  const writer = clauses.map((clause) => isWriterClause(text, clause));
  return clauses.flatMap((clause, i) =>
    writer[i]
      ? writerClauseCandidates(text, clause)
      : neighbourCandidates(clause, writer[i - 1] ?? false, writer[i + 1] ?? false),
  );
}
