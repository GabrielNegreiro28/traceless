import { alt, wordList } from './firstPersonLexicons';

/**
 * Closed function-word lists of the first-person rule pack (docs/design/fase2-gate-iteration.md
 * §G.3): standard English pronouns, determiners, prepositions, conjunctions, auxiliaries and
 * adverbs. They only ever STOP a match (tightening), so they never widen what a family flags.
 */

/** Adverbs that may sit between the first-person subject and the verb ("I'm currently the only"). */
export const ADVERB = alt(
  wordList(`
    usually normally always only mostly mainly generally typically currently now still also
    often sometimes regularly just then never basically literally practically effectively
    actually really
  `),
);

/** Words that end a noun phrase: function words, pronouns, auxiliaries, place/time adverbs. */
const NOUN_PHRASE_STOP_WORDS = wordList(`
  i me my mine we us our you your he him his she her they them their it its this that these
  those the a an who whom whose which what where when while why how
  on in at for with from by to into onto about after before since until over under between
  among during through without within around near of off out up down
  and or but so because if as than then though although whereas nor
  is am are was were be been being has have had do does did can could will would shall
  should may might must here there now today tonight anymore again too also either still
  currently really very just left
`);

/** A word that may be part of a noun phrase: letters, inner hyphens or apostrophes, no stop word. */
export const NOUN_PHRASE_WORD = `(?!${alt(NOUN_PHRASE_STOP_WORDS)}(?![A-Za-z'’-]))[A-Za-z][A-Za-z'’-]{0,30}`;

/**
 * Parties of the incident rather than job roles: "I'm the only target of his abuse", "I'm one
 * of 12 victims", "one of three witnesses" describe the harm, not the writer's post.
 */
export const INCIDENT_PARTY_HEADS: ReadonlySet<string> = new Set(
  wordList(`
    target targets victim victims witness witnesses survivor survivors complainant complainants
  `),
);

/**
 * Heads that make "I'm the only <X>" an opinion or a fact about the incident rather than a
 * role: "the only one who complained", "the only person left", "the only reason", "the only
 * target".
 */
export const GENERIC_HEADS: ReadonlySet<string> = new Set([
  ...wordList(`
    one ones person people thing things time times reason reasons way ways option options
    choice choices chance problem issue example exception answer hope solution difference
    place day days
  `),
  ...INCIDENT_PARTY_HEADS,
]);

/**
 * Words that break a tenure sentence between "I've worked/been" and "for N years": a new
 * clause (and, but, because), another subject (he, she, they) or a passive experience
 * ("I've been told for two years"). Regular -ed/-ing forms are checked separately.
 */
export const TENURE_GAP_STOP: ReadonlySet<string> = new Set(
  wordList(`
    and but because so while although though whereas or nor
    he she they it him her them his their its
    told said kept left made given shown sent paid taught held known seen taken written put
    let thrown caught brought bought forgotten
  `),
);

/** -ed/-ing forms still allowed in a tenure gap ("I've been working here for six years"). */
export const TENURE_GAP_ALLOWED_FORMS: ReadonlySet<string> = new Set(
  wordList('working employed based stationed'),
);

/**
 * General job titles for "I've been a/an <role> for N years" (tenure in the job sense). Any
 * other "been <X> for N years" ("in fear", "off work", "on medication") is incident duration.
 */
export const TENURE_ROLE_NOUNS: ReadonlySet<string> = new Set(
  wordList(`
    employee worker member manager supervisor nurse porter cleaner driver guard officer clerk
    assistant technician engineer teacher carer agent operator analyst leader lead chef cook
    cashier receptionist administrator coordinator volunteer apprentice trainee intern temp
    contractor paramedic doctor midwife pharmacist accountant developer designer consultant
    representative rep associate
  `),
);
