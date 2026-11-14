/**
 * Word shingles for test-set integrity checks: invented test or few-shot text must share no
 * 6-word sequence with any evaluation report. Test-only. Callers report counts, never the
 * shared text.
 */
export const SHINGLE_WORDS = 6;

/** Lower-cased words; an inner apostrophe stays part of the word ("i've"). */
export function shingleWords(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [];
}

/** Every run of SHINGLE_WORDS consecutive words of `text`. */
export function shingles(text: string): Set<string> {
  const list = shingleWords(text);
  const result = new Set<string>();
  for (let i = 0; i + SHINGLE_WORDS <= list.length; i++) {
    result.add(list.slice(i, i + SHINGLE_WORDS).join(' '));
  }
  return result;
}

/** All shingles of all `texts`, as one set to test candidates against. */
export function shingleIndex(texts: readonly string[]): Set<string> {
  return new Set(texts.flatMap((text) => [...shingles(text)]));
}

/** How many shingles of `candidate` occur in `index`. */
export function countSharedShingles(candidate: string, index: ReadonlySet<string>): number {
  return [...shingles(candidate)].filter((s) => index.has(s)).length;
}
