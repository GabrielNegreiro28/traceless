import { alt, SP, wordList } from './firstPersonLexicons';

/**
 * Closed place vocabulary of the LOCATION family (docs/design/fase2-gate-iteration.md §G.3,
 * on probation). The family is case-sensitive: a capitalised word after "my/our" is read as
 * a proper name ("our Leeds office"). Deletions and tightening only after the dev measurement.
 */

/** The same entries, also matching a capitalised first letter ("Depot" as well as "depot"). */
function withCapital(entries: readonly string[]): string[] {
  return entries.map((e) => `[${e.charAt(0).toUpperCase()}${e.charAt(0)}]${e.slice(1)}`);
}

/** Nouns naming a workplace site or a part of one. */
export const WORKPLACE_PLACE = alt(
  withCapital(
    wordList(`
      call_centre call_center office branch depot warehouse site store shop ward clinic
      pharmacy laboratory lab plant factory mill yard kitchen restaurant hotel school campus
      station terminal hangar dock garage workshop studio centre center facility outlet
      building floor wing unit
    `),
  ),
);

/**
 * Capitalised words that do NOT single out a site: every organisation has a "Head Office"
 * or a "Main building"; weekday names are times, not places.
 */
const GENERIC_CAPITALISED = alt(
  wordList(`
    Head Main Central Corporate Home New Old Local Company Regional National Global
    Monday Tuesday Wednesday Thursday Friday Saturday Sunday
  `),
);

/** A proper name: capitalised, not generic, not a possessive ("our CEO's office"). */
const PROPER_NAME = `(?!${GENERIC_CAPITALISED}(?![a-z]))[A-Z][a-z]{1,20}(?![A-Za-z'’])`;

/** Compass and level words that pick one site or floor among several. */
const DIRECTION = alt(
  wordList(`
    north-east north-west south-east south-west north south east west northern southern
    eastern western upper lower downstairs upstairs basement rear
  `),
);

/** Ordinals that pick one of several sites or floors ("our second warehouse", "4th-floor"). */
const ORDINAL = String.raw`(?:second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d{1,2}(?:st|nd|rd|th))`;

/** "first-floor", "ground floor", "top floor": a floor of the building. */
const FLOOR = String.raw`(?:(?:first|ground|top)[ -]floor)`;

/** One specifying modifier: a proper name, a direction, an ordinal (floor) or a floor. */
export const PLACE_SPECIFIER = `(?:${PROPER_NAME}|${DIRECTION}|${FLOOR}|${ORDINAL}(?:[ -]floor)?)`;

/** "my" or "our" in any common casing; the family's anchor. */
export const MY_OR_OUR = String.raw`\b(?:[Mm]y|[Oo]ur|MY|OUR)`;

/** Between "my/our" and the place: one to three specifiers ("our North Street branch"). */
export const SPECIFIED_PLACE = `(?:${PLACE_SPECIFIER}${SP}){1,3}${WORKPLACE_PLACE}`;
