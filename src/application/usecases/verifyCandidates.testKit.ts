import type { Candidate } from '../../domain/detection/candidates/candidateTypes';
import type { CandidateVerdict } from '../../domain/detection/candidates/verifiedFindings';
import type { RawText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import type { CandidateVerification, CandidateVerifier } from '../ports/CandidateVerifier';
import type { DisclosureCandidateFinder } from '../ports/DisclosureCandidates';

/** Test fakes for the verify pass (synthetic text only). */

/** Finds each of `quotes` (first occurrence) in the text, in text order. */
export function fakeFinder(quotes: readonly string[], fail = false): DisclosureCandidateFinder {
  return {
    find: (text: RawText): Promise<Result<Candidate[], AppError>> => {
      if (fail) return Promise.resolve(err(createAppError('Unknown', { message: 'no tagger' })));
      const found = quotes.flatMap((quote) => {
        const start = text.indexOf(quote);
        return start === -1 ? [] : [{ span: { start, end: start + quote.length }, quote }];
      });
      return Promise.resolve(ok(found.sort((a, b) => a.span.start - b.span.start)));
    },
  };
}

export interface VerifierCall {
  readonly chunk: string;
  readonly candidates: readonly string[];
}

/** Judges every candidate with `judge(quote)`; records each call. */
export function fakeVerifier(
  judge: (quote: string) => Omit<CandidateVerdict, 'index'>,
  overrides: Partial<CandidateVerification> | AppError = {},
) {
  const calls: VerifierCall[] = [];
  const verifier: CandidateVerifier = {
    verify: (chunk, candidates) => {
      calls.push({ chunk, candidates: [...candidates] });
      if ('kind' in overrides) return Promise.resolve(err(overrides));
      const verdicts = candidates.map((quote, index) => ({ index, ...judge(quote) }));
      return Promise.resolve(ok({ verdicts, source: 'ON_DEVICE', retries: 0, ...overrides }));
    },
  };
  return { verifier, calls };
}
