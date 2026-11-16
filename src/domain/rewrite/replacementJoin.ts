/**
 * Joins a replacement into the text around it so the rewrite stays readable English (pure).
 * Removals have their own policy (removalJoin.ts); these two rules apply at every edit
 * boundary.
 */

/** Articles and possessives that can sit right before a replaced span. */
const LEFT_DETERMINER = /(^|[^\p{L}\p{N}])(a|an|the|some|my|our|your|his|their)([ \t]+)$/iu;
/** Determiners a replacement can start with. */
const LEADING_DETERMINER =
  /^(a|an|the|some|my|our|your|his|her|their|this|that|these|those|one|another|any|several)\b/i;

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * When the text before a replaced span ends with a determiner and the replacement starts
 * with one ("at the" + "a company location"), the text's determiner is dropped and the
 * replacement's kept: "at a company location". A capitalized dropped determiner passes its
 * capital on ("The" + "the crew" → "The crew"). Otherwise the two are joined by
 * `joinAtBoundary`. Returns the left side followed by the replacement.
 */
export function appendReplacement(left: string, replacement: string): string {
  const match = LEADING_DETERMINER.test(replacement) ? LEFT_DETERMINER.exec(left) : null;
  if (!match) return joinAtBoundary(left, replacement);
  const determiner = match[2]!;
  const head = left.slice(0, left.length - determiner.length - match[3]!.length);
  const capital = determiner.charAt(0) !== determiner.charAt(0).toLowerCase();
  return head + (capital ? capitalizeFirst(replacement) : replacement);
}

const TRAILING_RUN = /[.,;:!?]+$/;
const LEADING_RUN = /^[.,;:!?]+/;
const ELLIPSIS = /^\.{3,}$/;

/** One mark for a doubled run: `?`/`!` win, else the last mark (".," → ",", ",." → "."). */
function collapseRun(run: string): string {
  return [...run].find((mark) => mark === '?' || mark === '!') ?? run.charAt(run.length - 1);
}

/**
 * Collapses a punctuation collision at an edit boundary: a run of `.,;:!?` that touches the
 * boundary from the right and either continues from the left ("some shifts." + ", and") or
 * starts with the dot of an abbreviation the span cut ("6 a.m" replaced, then "., and").
 * Runs wholly inside one side ("?!") and ellipses are kept as written.
 */
export function joinAtBoundary(left: string, right: string): string {
  const rightRun = LEADING_RUN.exec(right)?.[0] ?? '';
  const leftRun = TRAILING_RUN.exec(left)?.[0] ?? '';
  const run = leftRun + rightRun;
  if (rightRun === '' || run.length < 2 || ELLIPSIS.test(run)) return left + right;
  if (leftRun === '' && !rightRun.startsWith('.')) return left + right;
  const head = left.slice(0, left.length - leftRun.length);
  return head + collapseRun(run) + right.slice(rightRun.length);
}
