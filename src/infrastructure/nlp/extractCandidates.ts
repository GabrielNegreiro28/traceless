import type { RawCandidate } from '../../domain/detection/candidates/candidateTypes';
import { closingLines } from '../../domain/detection/candidates/closingLines';
import { clauseCandidates } from './clausePatterns';
import { splitClauses } from './clauses';
import { possessivePhrases } from './possessivePhrases';
import type { Sentence } from './taggedTokens';

/**
 * Every rough self-disclosure proposal of the tagged report, in whole-report offsets. Pure
 * over the tokens; `finalizeCandidates` trims, de-duplicates and caps them.
 */
export function extractCandidates(text: string, sentences: readonly Sentence[]): RawCandidate[] {
  return [
    ...closingLines(text),
    ...sentences.flatMap((sentence) => [
      ...possessivePhrases(text, sentence),
      ...clauseCandidates(text, splitClauses(sentence)),
    ]),
  ];
}
