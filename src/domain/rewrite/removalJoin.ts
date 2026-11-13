const TRAILING_HSPACE = /[ \t]+$/;
const LEADING_HSPACE = /^[ \t]+/;
/** Opening/closing tokens that make no sense once the text between them is removed. */
const EMPTIABLE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['(', ')'],
  ['[', ']'],
  ['"', '"'],
  ["'", "'"],
  ['“', '”'],
  ['‘', '’'],
  ['--', '--'],
  ['—', '—'],
  ['–', '–'],
];
const SOFT_TRAILING_PUNCTUATION = /[,;:]$/;
const PUNCTUATION_START = /^[,;:.!?]/;
const LEADING_PUNCTUATION = /^[,;:.!?]+[ \t]*/;
const NO_SPACE_BEFORE = /^[\n,;:.!?)\]]/;
const NO_SPACE_AFTER = /[\n([]$/;

function emptiedPair(left: string, right: string): readonly [string, string] | undefined {
  return EMPTIABLE_PAIRS.find(([open, close]) => left.endsWith(open) && right.startsWith(close));
}

/** At the start of the text or of a line, punctuation that opened the right side is dropped. */
function startsSentence(left: string): boolean {
  return left.length === 0 || left.endsWith('\n');
}

function dropDoubledPunctuation(left: string, right: string): string {
  if (!SOFT_TRAILING_PUNCTUATION.test(left) || !PUNCTUATION_START.test(right)) return left;
  return left.slice(0, -1).replace(TRAILING_HSPACE, '');
}

function needsSpace(left: string, right: string): boolean {
  if (left.length === 0 || right.length === 0) return false;
  return !NO_SPACE_AFTER.test(left) && !NO_SPACE_BEFORE.test(right);
}

/**
 * Joins the text around a removed span so the result reads naturally (pure).
 *
 * Policy, applied to `left` (everything before the removal) and `right` (what follows):
 * 1. Horizontal whitespace (spaces, tabs) touching the removal is trimmed on both sides;
 *    newlines are kept, so paragraphs survive.
 * 2. An emptied pair is dropped, then the join repeats: brackets `()` `[]`, quotes
 *    `""` `''` `“”` `‘’`, and parenthetical dashes `-- --` / `— —` / `– –`.
 * 3. At the start of the text or of a line, leading `,;:.!?` on the right is dropped
 *    (", my boss, said hi" → "my boss, said hi").
 * 4. Doubled punctuation collapses: a trailing `,;:` on the left is dropped when the right
 *    starts with `,;:.!?` ("nights, X, and" → "nights, and").
 * 5. A single space separates the two sides unless either side is empty, the left ends a
 *    line or opens a bracket, or the right starts a line or with closing punctuation.
 */
export function joinAroundRemoval(left: string, right: string): string {
  const l = left.replace(TRAILING_HSPACE, '');
  const r = right.replace(LEADING_HSPACE, '');
  const pair = emptiedPair(l, r);
  if (pair) return joinAroundRemoval(l.slice(0, -pair[0].length), r.slice(pair[1].length));
  if (startsSentence(l)) return l + r.replace(LEADING_PUNCTUATION, '');
  const head = dropDoubledPunctuation(l, r);
  return needsSpace(head, r) ? `${head} ${r}` : head + r;
}
