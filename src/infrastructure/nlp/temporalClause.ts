import type { RawCandidate } from '../../domain/detection/candidates/candidateTypes';
import { isWriterSubject } from './clauses';
import { hasTag, type Sentence } from './taggedTokens';
import { candidateOf, isTimeish } from './tokenRuns';

/** Subordinators that make a clause a time reference ("since I finished…"). */
const TEMPORAL_SUBORDINATORS = new Set([
  'when',
  'whenever',
  'while',
  'since',
  'after',
  'before',
  'until',
  'once',
]);
/** Words that may sit before the subordinator: "right after", "ever since", "just before". */
const LEAD_INS = new Set(['right', 'ever', 'just', 'shortly', 'soon', 'since', 'only', 'even']);
/** How far into a temporal clause its writer subject may sit ("since right after I…"). */
const SUBJECT_WINDOW = 4;

function writerSubjectWithin(text: string, clause: Sentence, from: number): boolean {
  return clause.slice(from, from + SUBJECT_WINDOW).some((t) => isWriterSubject(text, t));
}

/** Index where a temporal clause opened by a subordinator starts, with its lead-in words. */
function subordinateStart(clause: Sentence): number | null {
  const at = clause.findIndex((t) => TEMPORAL_SUBORDINATORS.has(t.norm));
  if (at === -1 || at > 2) return null;
  const leadIn = clause.slice(0, at).every((t) => LEAD_INS.has(t.norm) || hasTag(t, 'Adverb'));
  return leadIn ? 0 : at;
}

/** "the week I came back from leave": a time noun directly followed by a writer subject. */
function timeNounStart(text: string, clause: Sentence): number | null {
  const at = clause.findIndex(
    (t, i) => i > 0 && isWriterSubject(text, t) && isTimeish(clause[i - 1]),
  );
  if (at === -1) return null;
  const noun = at - 1;
  const det = clause[noun - 1];
  return det !== undefined && hasTag(det, 'Determiner') ? noun - 1 : noun;
}

/** A clause that dates something by the writer's own life events. */
export function temporalClause(text: string, clause: Sentence): RawCandidate[] {
  const opened = subordinateStart(clause);
  const start =
    opened !== null && writerSubjectWithin(text, clause, opened)
      ? opened
      : timeNounStart(text, clause);
  if (start === null) return [];
  const candidate = candidateOf(clause, start, clause.length, 'TEMPORAL_CLAUSE');
  return candidate === null ? [] : [candidate];
}
