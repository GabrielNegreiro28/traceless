import type { FirstPersonFamilyId } from './firstPersonFamilies';

/**
 * Invented test corpus of the first-person rule pack (docs/design/fase2-gate-iteration.md
 * §G.3). Written from scratch with unusual jobs and places (glassworks, kilns, orreries),
 * never from evaluation reports; firstPersonRules.disjoint.test.ts checks that it shares no
 * 6-word sequence with the dataset. Test-only: never imported by the app.
 */

/** A sentence and the exact quote its family must flag. */
export interface Positive {
  readonly text: string;
  readonly span: string;
  readonly start: number;
}

/** "I'm [the only glassblower] at…" → the text without brackets and the bracketed span. */
export function parsePositive(marked: string): Positive {
  const start = marked.indexOf('[');
  const end = marked.indexOf(']');
  if (start < 0 || end < start) throw new Error(`Unmarked positive: ${marked}`);
  const text = marked.slice(0, start) + marked.slice(start + 1, end) + marked.slice(end + 1);
  return { text, span: marked.slice(start + 1, end), start };
}

/** Positives per family; the bracketed words are the exact expected finding. */
export const MARKED_POSITIVES: Readonly<Record<FirstPersonFamilyId, readonly string[]>> = {
  onlyOne: [
    "I'm [the only glassblower] at the studio who works with cobalt.",
    'Honestly, I am [the only left-handed beekeeper] in the cooperative.',
    'im [the only piano tuner] they kept after the merger',
    "I'm currently [the only Welsh speaker] on the ferry crew.",
    'I am [the only keeper of keys] at the planetarium.',
    "Among zookeepers, I'm [the only reptile handler's assistant].",
    "I'm still [the only female crane operator], and everyone at the quarry knows it.",
    "I'm [the only kiln manager] on this floor, so ask me.",
  ],
  oneOfN: [
    "I'm [one of three lock keepers] on this stretch of canal.",
    'I am basically [one of only two kiln technicians] on the island.',
    'im [one of 4 tree surgeons] the parish still pays',
    "I'm just [one of the five beekeepers] who tend the rooftop hives.",
    'Officially I am [one of twelve ferry deckhands], but the rest rarely sail.',
    "I'm [one of two people] licensed to wind the orrery.",
    "I'm still [one of three women] casting bells here.",
  ],
  tenure: [
    "I've worked at the observatory gift shop [for eleven years].",
    'I have been a lighthouse volunteer [for 7 years] now.',
    'ive been with the firm [for nearly a decade], polishing orreries',
    "I've been working here [for over twelve years], mostly with falcons.",
    'I have worked in beekeeping [for almost 8 months].',
    "I've only worked aquarium nights [for six months].",
    'I have been employed [for 9 years] by Kestrel Ferries.',
    'Kiln-wise, I have been in this role [for four years].',
    "I've been here [for 11 years], feeding the kilns.",
  ],
  shift: [
    'I [work nights] at the ice rink.',
    'I [start at 4:45am], gelato permitting.',
    'I always [cover lates], gelato season or not.',
    'Orchid-wise, we [cover every other Sunday].',
    "Toll-bridge wise, I'm [on the graveyard shift].",
    'Puppet-wise I am [rostered on Tuesdays].',
    'At the boathouse i [finish at 11:55 p.m.] nightly',
    "We're [on lates] at the ski lift all winter.",
    "Hovercraft season means I've been [working doubles].",
    'Before the merger I [worked alternate Saturdays] at the kiln.',
    'We were [on lates] at the gelato stand every winter.',
    'Glaziers aside, we [start at 6am], not 7.',
  ],
  employmentEvent: [
    '[Since I joined], the kiln schedule has been rewritten twice.',
    '[When I was promoted] to orchid curator, the rota changed.',
    '[after I got back from shared parental leave] the locker was gone',
    'Planetarium logbooks vanish ever [since I started here].',
    '[When I returned from furlough], kiln keys vanished.',
    '[After I first joined], glassworks stock went missing.',
    'Orchids wilt [since I returned to work].',
  ],
  namedSite: [
    'Everyone at our [Harbourside depot] uses the same label printer.',
    'My [North Quay warehouse] badge reader logs every entry.',
    'Glaze leaked in our [third-floor laboratory] last spring.',
    'I moved to our [upstairs studio] after the flood.',
    'Our [Kestrel Lane garage] closes early on bank holidays.',
    'Parcels for my [eastern office] pile up by the door.',
    'Our [second warehouse] near the ring road floods every winter.',
  ],
};

/** Invented sentences that must fire no first-person family at all. */
export const HARD_NEGATIVES: readonly string[] = [
  'I saw the glazier on Saturday night near the boathouse.',
  'Kilns: the only time I complained, nobody came.',
  'Glazing, one of the reasons I linger, pays badly.',
  'I have been told by glaziers for years that the kiln is fine.',
  'Since I don’t know the kiln code, I asked the glazier.',
  'Our company policy on kilns says nothing.',
  'My concern is the office kiln.',
  'He works nights at the ice rink.',
  'She is the only glassblower left in the studio.',
  'The glaziers are on the graveyard shift.',
  "I'm the only one, glaziers say, who noticed.",
  'I am the only person, glaziers insist.',
  'I heard one of two wardens shouting at the volunteers.',
  'I was one of five glaziers at the lantern meeting.',
  "I've been waiting on glaziers for two months.",
  'I have been ignored by kiln wardens for three years.',
  'When I started complaining, the glaziers laughed.',
  'When I joined the kiln call, the warden hung up.',
  'After I transferred the kiln deposit back, the treasurer apologised.',
  'When I came back from glazing, the till was open.',
  'Our office is beside the glassworks.',
  'Our new office smells of kiln smoke.',
  'Our Head Office glaziers met on Friday.',
  'I told the glazier he starts at 6am.',
  'I worked two glazing days last week.',
  'I work most days beside glaziers.',
  'I did no glazing on Saturday.',
  "We're on Monday's kiln agenda.",
  'I took three glazing days off in March.',
  "I've worked with the same kiln software for years.",
  "I'm one of the glaziers who signed.",
  'I am only the kiln messenger here.',
  "I'm the only reason the gelato stall stays open.",
  'His only kiln shift is on Sundays.',
  'The only glazier on nights is a contractor.',
  'My glazing manager works weekends.',
  'We know the glazier starts at 7am.',
  'Since I moved house, the kiln commute is long.',
  'When I started to notice kiln gaps, I kept notes.',
  'After I started the kiln stocktake, ledgers vanished.',
  "Our treasurer's kiln office was locked.",
  'My Monday glazing office hours are short.',
  "I'm on the kiln phone at 3pm.",
  'Glaziers: we are on day two.',
  'When I returned the kiln keys, the warden thanked me.',
  'Our team of four glaziers handles returns.',
  'I work in the glassworks gift shop.',
  'In my view the only kiln fix is a padlock.',
  // Incident duration after "been" is not tenure.
  "I've been in this kiln dispute for two years.",
  "I've been in fear of the warden for a year.",
  "I've been off work for two months because of the glazier.",
  "I've been on kiln-burn medication for six months.",
  'I have been in contact with the kiln union for three months.',
  "I've been sick for two months since the kiln fire.",
  // Past tense alone is the incident, not a roster.
  'I finished at 10pm that night when the glazier grabbed me.',
  'I was working on Monday when the glazier hit me.',
  'We started at 9am and the glazier arrived drunk at noon.',
  'I was on the night shift when the kiln cracked.',
  'I did nights at the kiln last winter.',
  // Parties of the incident are not roles or teams.
  "I'm the only target of the glazier's abuse.",
  "I'm one of 12 victims of the kiln fraud.",
  'I am one of three witnesses to the kiln fire.',
  // Someone else's quoted or reported words.
  'The warden shouted "I\'m the only kiln manager on this floor, so shut up."',
  'The warden shouted “I’m the only kiln manager on this floor, so shut up.”',
  'The warden said to me: I am the only kiln manager here.',
  "The glazier said 'we start at 6am, not 7'",
  'The glazier said ‘we start at 6am, not 7’',
  'The glazier texted "Stop asking. I\'m the only kiln manager here."',
];

/** Phrases a family would match only across a sentence or line boundary. */
export const BOUNDARY_NEGATIVES: readonly string[] = [
  "I'm the only.\nGlassblower here is a contractor.",
  'I work. Nights at the kiln are quiet.',
  "I've worked at the kiln. For ten years the kiln was calm.",
  'I am one of three\nlock keepers were hired later.',
  'Since I. Joined the glassworks, nothing.',
  'Our Harbourside.\nDepot staff use the printer.',
  "I'm on.\nThe graveyard shift belongs to someone else.",
];
