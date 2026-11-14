import { describe, expect, it } from 'vitest';
import { FIRST_PERSON_FAMILY_IDS } from './firstPersonFamilies';
import { detectFirstPersonMatches } from './firstPersonRules';
import {
  BOUNDARY_NEGATIVES,
  HARD_NEGATIVES,
  MARKED_POSITIVES,
  parsePositive,
} from './firstPersonRules.testKit';

type Subject = 'He' | 'She';

function singular(he: string, his: string, him: string, hers: string): Record<string, string> {
  return {
    i: he,
    "i'm": `${he}'s`,
    "i've": `${he}'s`,
    "i'd": `${he}'d`,
    "i'll": `${he}'ll`,
    im: `${he}'s`,
    ive: `${he}'s`,
    my: his,
    mine: hers,
    me: him,
    myself: `${him}self`,
  };
}

const SINGULAR: Readonly<Record<Subject, Readonly<Record<string, string>>>> = {
  He: singular('he', 'his', 'him', 'his'),
  She: singular('she', 'her', 'her', 'hers'),
};
const PLURAL: Readonly<Record<string, string>> = {
  we: 'they',
  "we're": "they're",
  "we've": "they've",
  "we'd": "they'd",
  "we'll": "they'll",
  our: 'their',
  ours: 'theirs',
  us: 'them',
};
const FIRST_PERSON_WORD =
  /\b(?:(?:i|we)['’](?:m|ve|d|ll|re)|i|im|ive|my|mine|me|myself|we|our|ours|us)\b/gi;

function capitalise(word: string, like: string): string {
  return /^[A-Z]/.test(like) ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/** The third-person twin of a word: I→He, I'm→He's, my→his, our→their, we→they, me→him. */
function swapWord(word: string, subject: Subject): string {
  const key = word.toLowerCase().replace('’', "'");
  return capitalise(SINGULAR[subject][key] ?? PLURAL[key] ?? word, word);
}

function toThirdPerson(text: string, subject: Subject): string {
  return text.replace(FIRST_PERSON_WORD, (word) => swapWord(word, subject));
}

const ALL = FIRST_PERSON_FAMILY_IDS;
const positives = ALL.flatMap((id) => MARKED_POSITIVES[id].map(parsePositive));

describe('first-person pack: third-person twins', () => {
  it('swaps the pronouns as specified', () => {
    expect(toThirdPerson("I'm sure my team and I know our rota; we told me.", 'He')).toBe(
      "He's sure his team and He know their rota; they told him.",
    );
    expect(toThirdPerson("I've seen us. im here, ive left", 'She')).toBe(
      "She's seen them. she's here, she's left",
    );
  });

  it.each(['He', 'She'] as const)('fires zero times on every positive told by %s', (subject) => {
    const twins = positives.map((p) => toThirdPerson(p.text, subject));
    expect(twins.flatMap((t) => detectFirstPersonMatches(t, ALL))).toEqual([]);
  });
});

describe('first-person pack: hard negatives', () => {
  it('has at least 40 invented hard negatives', () => {
    expect(HARD_NEGATIVES.length).toBeGreaterThanOrEqual(40);
  });

  it.each(HARD_NEGATIVES.map((t) => [t]))('never fires on "%s"', (text) => {
    expect(detectFirstPersonMatches(text, ALL)).toEqual([]);
  });

  it.each(BOUNDARY_NEGATIVES.map((t) => [JSON.stringify(t)] as const))(
    'never matches across a sentence or line boundary: %s',
    (encoded) => {
      expect(detectFirstPersonMatches(JSON.parse(encoded) as string, ALL)).toEqual([]);
    },
  );

  it('fires nothing on an empty or pronoun-only text', () => {
    expect(detectFirstPersonMatches('', ALL)).toEqual([]);
    expect(detectFirstPersonMatches('I. Me. My. We. Our. Us.', ALL)).toEqual([]);
  });
});
