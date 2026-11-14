/**
 * Reported speech guard of the first-person rule pack (docs/design/fase2-gate-iteration.md
 * §G.3, tightening only): an "I"/"we" inside someone else's quoted or reported words is the
 * speaker talking, not the writer (He shouted "I'm the only manager here"). Pure.
 */

/** Verbs that introduce someone's words: `He said to me: I am…`, `she texted: we start…`. */
const SPEECH_VERB_THEN_COLON =
  /\b(?:said|says|told|tells|shouted|yelled|screamed|claimed|wrote|texted|messaged)\b[^.!?\n:"“”‘’]{0,40}:/i;

const LETTER_OR_DIGIT = /[A-Za-z0-9]/;

function isWordChar(ch: string): boolean {
  return LETTER_OR_DIGIT.test(ch);
}

/** Where the line (paragraph) holding `offset` starts: quotes may span sentences, not lines. */
function lineStart(text: string, offset: number): number {
  return text.lastIndexOf('\n', offset - 1) + 1;
}

function sentenceStart(text: string, offset: number): number {
  let at = offset;
  while (at > 0) {
    const ch = text.charAt(at - 1);
    if (ch === '\n' || ch === '!' || ch === '?') break;
    if (ch === '.' && /\s/.test(text.charAt(at))) break;
    at -= 1;
  }
  return at;
}

/**
 * A single quote at a word start opens ('we start…, ‘we…); at a word end it closes. An
 * apostrophe between letters (I'm, don't, I’ve) is neither.
 */
function singleQuoteEffect(text: string, i: number): 'open' | 'close' | null {
  const before = text.charAt(i - 1);
  const after = text.charAt(i + 1);
  const opensWord = !isWordChar(before) && isWordChar(after);
  const closesWord = !isWordChar(after) && (isWordChar(before) || /[.,!?]/.test(before));
  if (opensWord) return 'open';
  return closesWord ? 'close' : null;
}

/** True when a double or single quotation opened before `offset` on its line is still open. */
export function isInsideQuote(text: string, offset: number): boolean {
  let double = false;
  let single = false;
  for (let i = lineStart(text, offset); i < offset; i++) {
    const ch = text.charAt(i);
    if (ch === '"') double = !double;
    else if (ch === '“') double = true;
    else if (ch === '”') double = false;
    else if (ch === "'" || ch === '‘' || ch === '’') {
      const effect = singleQuoteEffect(text, i);
      if (effect === 'open' && ch !== '’') single = true;
      else if (effect === 'close' && ch !== '‘') single = false;
    }
  }
  return double || single;
}

/** True when `anchor` sits in quoted words or after "said/told/… :" in its sentence. */
export function isInReportedSpeech(text: string, anchor: number): boolean {
  if (isInsideQuote(text, anchor)) return true;
  return SPEECH_VERB_THEN_COLON.test(text.slice(sentenceStart(text, anchor), anchor));
}
