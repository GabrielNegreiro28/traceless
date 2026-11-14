import { wordList } from './firstPersonLexicons';
import {
  GENERIC_HEADS,
  INCIDENT_PARTY_HEADS,
  TENURE_GAP_ALLOWED_FORMS,
  TENURE_GAP_STOP,
  TENURE_ROLE_NOUNS,
} from './firstPersonWords';

/**
 * Post-match checks of the first-person families (docs/design/fase2-gate-iteration.md §G.3)
 * for what one regex cannot say cleanly. Every check can only REJECT a regex match.
 */

/** What a family check sees: the named groups of the match and the text right after the span. */
export interface PatternMatch {
  readonly groups: Readonly<Partial<Record<string, string>>>;
  /** Up to 40 characters that follow the span (may be empty at the end of the text). */
  readonly after: string;
}

function wordsOf(phrase: string | undefined): string[] {
  return (phrase ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w !== '');
}

/** "I'm the only <np>": rejects a generic head ("the only one who…", "the only person left"). */
export function hasRoleHead({ groups }: PatternMatch): boolean {
  const head = wordsOf(groups['np']).at(-1);
  return head !== undefined && !GENERIC_HEADS.has(head);
}

/** "one of N <plural>": rejects a party of the incident ("one of 12 victims", "three witnesses"). */
export function hasNonPartyHead({ groups }: PatternMatch): boolean {
  const head = wordsOf(groups['span']).at(-1);
  return head !== undefined && !INCIDENT_PARTY_HEADS.has(head);
}

/** Words after which an -ing/-ed form is a noun ("in nursing", "the morning shift"). */
const NOUN_INTRODUCERS: ReadonlySet<string> = new Set(
  wordList('in on at into with of for the this that a an my our'),
);

function isGapWordAllowed(word: string, previous: string | undefined): boolean {
  if (TENURE_GAP_STOP.has(word)) return false;
  if (TENURE_GAP_ALLOWED_FORMS.has(word) || !/(?:ing|ed)$/.test(word)) return true;
  return previous !== undefined && NOUN_INTRODUCERS.has(previous);
}

/** "been <here | at the company | in this role | a night porter>": the job sense of "been". */
const JOB_SENSE_PLACE =
  /^(?:here|there|(?:at|with) (?:the|this) (?:company|firm|team|organisation|organization)|in (?:the|this|my) (?:job|role|post|position|team|department|unit)|an? member of (?:the )?(?:staff|team))$/;

function isRolePhrase(words: readonly string[]): boolean {
  const [article, ...rest] = words;
  const role = rest.at(-1);
  return (
    (article === 'a' || article === 'an') &&
    rest.length >= 1 &&
    rest.length <= 2 &&
    role !== undefined &&
    TENURE_ROLE_NOUNS.has(role)
  );
}

/**
 * The gap after "been" must name the job, never a state ("in fear", "off work", "sick", "in
 * contact with HR"): empty, here/there, the company/team, the role/post, or a/an + job title,
 * optionally after "working"/"employed" ("been working here").
 */
function isBeenJobGap(words: readonly string[]): boolean {
  const rest = TENURE_GAP_ALLOWED_FORMS.has(words[0] ?? '') ? words.slice(1) : words;
  return rest.length === 0 || JOB_SENSE_PLACE.test(rest.join(' ')) || isRolePhrase(rest);
}

/**
 * "I've worked/been <gap> for N years": the gap must stay one clause about the writer's own
 * job. It rejects a new clause or subject ("and he has"), an irregular passive ("been told")
 * and a verb in -ing/-ed ("been waiting", "been ignored") unless it reads as a noun after a
 * preposition or determiner ("in nursing") or is an allowed form ("been working here"). After
 * "been" the gap must also be in the job sense (isBeenJobGap): incident duration never fires.
 */
export function isTenureGap({ groups }: PatternMatch): boolean {
  const words = wordsOf(groups['gap']);
  if (!words.every((word, i) => isGapWordAllowed(word, words[i - 1]))) return false;
  return groups['verb']?.toLowerCase() !== 'been' || isBeenJobGap(words);
}

const CLAUSE_END_AFTER = /^[ \t]*(?:[,.;:!?)\n]|$)/;
const ADJUNCT_AFTER =
  /^[ \t]{1,3}(?:in|at|as|with|last|back|i|my|we|and|but|the[ \t]{1,3}(?:company|team|firm|job)|this[ \t]{1,3}(?:company|team|firm|job|role))(?![A-Za-z'’-])/i;
const TO_AFTER = /^[ \t]{1,3}to(?![A-Za-z'’-])/i;

/**
 * "(when|after|since) I <event>": the event must end the clause or be followed by an adjunct
 * ("in 2019", "as a temp", "the company"), so "when I started complaining", "when I joined
 * the call" and "after I transferred the money" never fire. Only promotions and transfers
 * may continue with "to" ("since I was promoted to supervisor"; not "I started to notice").
 */
export function endsEmploymentEvent({ groups, after }: PatternMatch): boolean {
  if (CLAUSE_END_AFTER.test(after) || ADJUNCT_AFTER.test(after)) return true;
  return /promoted|transferred/i.test(groups['event'] ?? '') && TO_AFTER.test(after);
}
