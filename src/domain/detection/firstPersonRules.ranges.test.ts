import { describe, expect, it } from 'vitest';
import { SAMPLE_REPORT } from '../report/sampleReport';
import { detectFirstPersonMatches, MAX_SPAN_WORDS } from './firstPersonRules';
import { SCHEDULE_MAX_SPAN_WORDS } from './firstPersonFamilies';

/**
 * Regression from the sample walkthrough: the shift family flagged only "work Tuesday" in
 * "I work Tuesday to Saturday, from 10 p.m. to 6 a.m.", so accepting it left
 * "work some shifts to Saturday, from 10 p.m. to 6 a.m.". A schedule range is one finding.
 */

function shiftQuotes(text: string): string[] {
  return detectFirstPersonMatches(text, ['shift']).map((m) => m.finding.quote);
}

describe('shift family: weekday and clock ranges', () => {
  it('flags the whole schedule of the sample report as one finding', () => {
    expect(shiftQuotes(SAMPLE_REPORT)).toEqual([
      'work Tuesday to Saturday, from 10 p.m. to 6 a.m.',
    ]);
  });

  it.each([
    ['I work Monday–Friday at the kiln.', 'work Monday–Friday'],
    ['I work Monday - Friday at the kiln.', 'work Monday - Friday'],
    ['We cover Saturdays and Sundays.', 'cover Saturdays and Sundays'],
    ['I work Tuesday through Thursday nights.', 'work Tuesday through Thursday nights'],
    ['I start at 10pm until 6am most weeks.', 'start at 10pm until 6am'],
    ['I work from 10 p.m. to 6 a.m., then sleep.', 'work from 10 p.m. to 6 a.m.'],
    ['I work nights, from 9pm to 5am.', 'work nights, from 9pm to 5am'],
  ])('%s', (text, quote) => {
    expect(shiftQuotes(text)).toEqual([quote]);
  });

  it('keeps single time terms as before', () => {
    expect(shiftQuotes('I work nights and days off are rare.')).toEqual(['work nights']);
    expect(shiftQuotes('I work Tuesday, and Gary knows.')).toEqual(['work Tuesday']);
  });

  it('allows a longer span only for schedules', () => {
    expect(SCHEDULE_MAX_SPAN_WORDS).toBeGreaterThan(MAX_SPAN_WORDS);
  });
});
