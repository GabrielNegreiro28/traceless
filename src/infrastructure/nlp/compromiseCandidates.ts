import type { DisclosureCandidateFinder } from '../../application/ports/DisclosureCandidates';
import type { Candidate } from '../../domain/detection/candidates/candidateTypes';
import { finalizeCandidates } from '../../domain/detection/candidates/finalizeCandidates';
import type { RawText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import { extractCandidates } from './extractCandidates';
import { toSentences } from './taggedTokens';

/** Parses text into compromise's JSON (sentences of terms with offsets and tags). */
export type Tagger = (text: string) => unknown;

/**
 * Loads compromise on first use only (a dynamic import, so it never weighs on the initial
 * bundle). `compromise/two` is the tagger without the heavier phrase-level plugins.
 */
async function loadCompromiseTagger(): Promise<Tagger> {
  const { default: nlp } = await import('compromise/two');
  return (text): unknown => {
    const json: unknown = nlp(text).json({ offset: true, terms: { offset: true }, text: false });
    return json;
  };
}

function nlpFailure(cause: unknown): AppError {
  return createAppError('Unknown', { message: 'The on-device text analyser failed.', cause });
}

/**
 * Layer 2 adapter: compromise part-of-speech tags → grammatical self-disclosure patterns →
 * pure post-processing. Runs entirely in the page; no model, no network.
 */
export class CompromiseCandidateFinder implements DisclosureCandidateFinder {
  private tagger: Promise<Tagger> | null = null;
  private readonly loadTagger: () => Promise<Tagger>;

  /** `loadTagger` is replaceable in tests (for example to simulate a failing load). */
  constructor(loadTagger: () => Promise<Tagger> = loadCompromiseTagger) {
    this.loadTagger = loadTagger;
  }

  async find(text: RawText): Promise<Result<Candidate[], AppError>> {
    try {
      this.tagger ??= this.loadTagger();
      const sentences = toSentences(text, (await this.tagger)(text));
      if (sentences === null) {
        return err(createAppError('Unknown', { message: 'Unexpected text analyser output.' }));
      }
      return ok(finalizeCandidates(text, extractCandidates(text, sentences)));
    } catch (cause) {
      this.tagger = null;
      return err(nlpFailure(cause));
    }
  }
}
