import { describe, expect, it } from 'vitest';
import { toRawText } from '../text/brandedText';
import { buildProtectedTerms, suppressProtected } from './protectedMentions';
import type { Finding } from './types';

/** Runs the filter on "<protected> approved it. <finding>." and returns the kept quotes. */
function keptAfter(protectedQuote: string, findingQuote: string): string[] {
  const text = toRawText(`${protectedQuote} approved the payments. ${findingQuote}.`);
  const start = text.lastIndexOf(findingQuote);
  const finding: Finding = {
    id: `MODEL:${start}`,
    span: { start, end: start + findingQuote.length },
    quote: findingQuote,
    category: 'ROLE_UNIQUE',
    reason: 'r',
    suggestion: null,
    origin: 'MODEL',
  };
  return suppressProtected(text, [finding], buildProtectedTerms([protectedQuote])).kept.map(
    (f) => f.quote,
  );
}

describe('suppressProtected never hides a writer detail that only shares a word', () => {
  it.each([
    ['Site Manager Gary Holt', 'the only Site Engineer on the east wing'],
    ['Finance Director Mark Hill', 'The Finance team is just three people'],
    ['Night Supervisor Ana Cruz', 'Night Shift on Ward 7'],
    ['Sister Jones on Ward 7', 'The only pharmacist on Ward 7'],
    ['Riverside Depot', 'The only driver at Riverside Depot on Sundays'],
    ['Site Manager Gary Holt', 'the timesheets that Holt signs for my crew'],
    ['Site Manager Gary Holt', 'the gate next to the office Holt uses'],
    ['Manager Tom Reed', 'Tom Alvarez works the only forklift'],
    ['Director Jordan Hale', 'Jordan Street branch has only two tellers'],
  ])('protected "%s" keeps "%s"', (protectedQuote, findingQuote) => {
    expect(keptAfter(protectedQuote, findingQuote)).toEqual([findingQuote]);
  });

  it.each([
    ['Site Manager Gary Holt', 'Holt signs the timesheets'],
    ['Site Manager Gary Holt', "Holt's van at the yard"],
    ['Night Supervisor Ana Cruz', 'Ms. Cruz moves the rota'],
    ['Site Manager Wade Pruitt', 'Wade had the gate codes'],
    ['Site Manager Wade Pruitt', 'Wade knows the alarm schedule'],
    ['the bursar, Mr. Hollister', 'Mr. Hollister signs the cheques'],
    ['the clinic director, Dr. Ingrid Strand', 'Dr. Strand moved her rota'],
    ['the shift lead, Brent Lindahl', 'Brent always leaves early'],
    ['The owner, Mr. Castellano', 'Castellano keeps two books'],
  ])('protected "%s" still drops a mention that starts with the name: "%s"', (p, finding) => {
    expect(keptAfter(p, finding)).toEqual([]);
  });

  it('KNOWN LIMITATION: a writer finding opening with a shared first name is dropped', () => {
    expect(
      keptAfter('Supervisor Lena Ortiz', 'Lena and the night porter are the only two'),
    ).toEqual([]);
  });
});
