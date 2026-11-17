import { z } from 'zod';

/** One word of a sentence as compromise tagged it, with exact offsets into the report. */
export interface Token {
  /** The word exactly as written (`report.slice(start, end)`). */
  readonly text: string;
  /** Lower-case form; for contractions the expanded word ("i" for "I'm"). */
  readonly norm: string;
  readonly start: number;
  readonly end: number;
  /** compromise part-of-speech tags (Noun, Pronoun, Verb, Preposition, Date…). */
  readonly tags: ReadonlySet<string>;
  /** Punctuation and whitespace after the word, as written. */
  readonly post: string;
}

export type Sentence = readonly Token[];

/** The subset of compromise `json({ offset: true, terms: { offset: true } })` we read. */
const termSchema = z.object({
  text: z.string(),
  post: z.string().default(''),
  tags: z.array(z.string()),
  implicit: z.string().optional(),
  offset: z.object({ start: z.number().int().min(0), length: z.number().int().min(0) }),
});
const sentencesSchema = z.array(z.object({ terms: z.array(termSchema) }));

type Term = z.infer<typeof termSchema>;

/** Implicit words of contractions (the "am" of "I'm") have no text of their own: skipped. */
function toToken(report: string, term: Term): Token | null {
  const { start, length } = term.offset;
  if (length === 0 || report.slice(start, start + length) !== term.text) return null;
  const norm = (term.implicit ?? term.text).toLowerCase();
  return {
    text: term.text,
    norm,
    start,
    end: start + length,
    tags: new Set(term.tags),
    post: term.post,
  };
}

/**
 * Converts compromise's JSON into sentences of located tokens. Tokens whose offsets do not
 * match the report exactly are dropped, so every token span is a true slice of `report`.
 * Null when the JSON does not have the expected shape.
 */
export function toSentences(report: string, json: unknown): Sentence[] | null {
  const parsed = sentencesSchema.safeParse(json);
  if (!parsed.success) return null;
  return parsed.data
    .map((sentence) => sentence.terms.flatMap((term) => toToken(report, term) ?? []))
    .filter((tokens) => tokens.length > 0);
}

export function hasTag(token: Token | undefined, tag: string): boolean {
  return token?.tags.has(tag) ?? false;
}
