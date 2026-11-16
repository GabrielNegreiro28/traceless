import { SIGN_OFF_RULE } from './detectionRules';
import { isSelfDescription } from './signOffDescription';
import { buildFindingId } from './span';
import type { Finding, TextSpan } from './types';

/** Why the last line counts as a sign-off. */
type Trigger = 'blank' | 'cue' | 'dash';

const MAX_WORDS = 5;
/**
 * A closing line on its own: "Regards,", "Best regards,", "Thanks", "Sincerely", with or
 * without what the thanks are for ("Thanks for listening,", "Thank you for your time.").
 */
const CUE_LINE =
  /^(?:(?:kind|best|warm|many)\s+)?(?:regards|best|sincerely|signed|thanks|thank\s+you|respectfully|cheers|yours(?:\s+(?:truly|sincerely))?)(?:\s+for\s+[a-z'’ ]{1,40}?)?\s*[,.!:]?$/i;
/** A leading dash; only an em/en dash or "--" is a cue by itself (a single "-" is a bullet). */
const DASH_PREFIX = /^(?:—|–|-{1,2})[ \t]*/u;
const DASH_CUE = /^(?:—|–|--)/u;
const NAME_WORD = /^\p{Lu}\p{Ll}+(?:[-'’]\p{Lu}?\p{Ll}+)*[,.]?$/u;
/** "M.", "K.L.", but not a lone "I." (the pronoun ending a sentence). */
const INITIALS_WORD = /^(?:(?:\p{Lu}\.){2,}|(?!I\.)\p{Lu}\.),?$/u;
/**
 * Words that rule a line out: honorifics mostly introduce other people ("Thank you,
 * Ms. Jones"); an article means a description ("A Concerned Employee"); nobody-words
 * ("Anonymous", "Everyone") and group or department words ("IT Department") are not a name.
 */
const EXCLUDING_WORDS = [
  /^(?:mr|ms|mrs|mx|dr|prof)\.?,?$/i,
  /^(?:a|an|the)$/i,
  /^(?:anonymous|everyone|everybody|all|team|department|dept|office|unit|division|services|desk|group|staff|management|committee|board|crew|shift|lab)[,.!]?$/i,
];
/** Function words and verbs that make a title-case line a sentence ("Please Help Us Now"). */
const SENTENCE_WORD =
  /^(?:please|help|us|now|stop|thank|thanks|of|and|for|is|are|was|be|we|you|our|my|me|it|this|that|to|in|on|at|with|not|no|do|can|will|check|stay|safe)[,.!]?$/i;
/** "P.S." / "PS" / "P.P.S." notes are not signatures. */
const POSTSCRIPT = /^p\.?\s?(?:p\.?\s?)?s\b/i;
/** A sentence ("Thank you.", "Please investigate.") rather than a signature. */
const SENTENCE_END = /(?:[\p{Ll}\d][.!?]|[!?])$/u;
const MIN_TITLE_CASE_WORDS = 3;

interface Line {
  readonly start: number;
  readonly end: number;
}

/** The last non-blank line (trimmed) and the raw line before it, if any. */
function lastLines(text: string): { line: Line; previous: string | null } | null {
  const end = text.trimEnd().length;
  if (end === 0) return null;
  const lineStart = text.lastIndexOf('\n', end - 1) + 1;
  const start = end - text.slice(lineStart, end).trimStart().length;
  if (lineStart === 0) return { line: { start, end }, previous: null };
  const previousStart = text.lastIndexOf('\n', lineStart - 2) + 1;
  return { line: { start, end }, previous: text.slice(previousStart, lineStart - 1) };
}

function triggerOf(dash: string, previous: string | null): Trigger | null {
  if (DASH_CUE.test(dash)) return 'dash';
  if (previous === null) return null;
  if (previous.trim() === '') return 'blank';
  return CUE_LINE.test(previous.trim()) ? 'cue' : null;
}

/**
 * Lines that are never a personal signature, whatever came before them: a postscript,
 * an excluding word, or a title-case line of 3+ words that reads as a sentence.
 */
function isNeverSignature(words: readonly string[], body: string): boolean {
  if (POSTSCRIPT.test(body)) return true;
  if (words.some((w) => EXCLUDING_WORDS.some((re) => re.test(w)))) return true;
  const titleCase = words.length >= MIN_TITLE_CASE_WORDS && words.every((w) => /^\p{Lu}/u.test(w));
  return titleCase && words.some((w) => SENTENCE_WORD.test(w));
}

/** Whether the words look like a signature for this trigger. */
function looksSigned(
  words: readonly string[],
  body: string,
  trigger: Trigger,
  dashed: boolean,
): boolean {
  if (words.length === 0 || words.length > MAX_WORDS) return false;
  if (isNeverSignature(words, body)) return false;
  if (words.some((w) => INITIALS_WORD.test(w))) return true;
  if (trigger !== 'blank' || dashed) return words.some((w) => NAME_WORD.test(w));
  // After a mere blank line the first word is capitalised anyway: need a later name.
  return !SENTENCE_END.test(body) && words.slice(1).some((w) => NAME_WORD.test(w));
}

const DESCRIPTION_REASON =
  'A description of yourself at the end of a report signs it as clearly as a name.';

/** Why the line is a signature: it names the writer, or (after a cue or dash) describes them. */
function signatureReason(
  words: readonly string[],
  body: string,
  trigger: Trigger,
  dashed: boolean,
): string | null {
  if (looksSigned(words, body, trigger, dashed)) return SIGN_OFF_RULE.reason;
  const described = trigger !== 'blank' && isSelfDescription(words, body);
  return described ? DESCRIPTION_REASON : null;
}

/**
 * The sign-off finding, if the report's last line follows a blank line, a closing cue line
 * or a dash, and holds a name or initials (at most 5 words) or, after a cue or a dash, a
 * short description of the writer ("the tired trainer on the night shift"). Hard
 * negatives: "Thank you.", "Please investigate.", "Best regards." on their own.
 */
export function detectSignOff(text: string): Finding[] {
  const lines = lastLines(text);
  if (lines === null) return [];
  const raw = text.slice(lines.line.start, lines.line.end);
  const dash = DASH_PREFIX.exec(raw)?.[0] ?? '';
  const trigger = triggerOf(dash, lines.previous);
  const body = raw.slice(dash.length);
  const words = body.split(/[ \t]+/).filter((w) => w !== '');
  if (trigger === null) return [];
  const reason = signatureReason(words, body, trigger, dash !== '');
  if (reason === null) return [];
  const span: TextSpan = { start: lines.line.start + dash.length, end: lines.line.end };
  const { category, suggestion } = SIGN_OFF_RULE;
  return [
    {
      id: buildFindingId('RULE', span, category),
      span,
      quote: body,
      category,
      reason,
      suggestion,
      origin: 'RULE',
    },
  ];
}
