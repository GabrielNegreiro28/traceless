import { describe, expect, it } from 'vitest';
import { hasFirstPersonPlural, hasFirstPersonSingular } from './firstPerson';

describe('hasFirstPersonPlural', () => {
  it.each(['two of us', 'we all saw it', 'our team of three', 'the keys are ours', 'Ourselves'])(
    'finds the writer group in "%s"',
    (text) => expect(hasFirstPersonPlural(text)).toBe(true),
  );

  it.each(['the user logs', 'He always leaves early', 'a weekly report', 'sour milk'])(
    'finds no plural first person in "%s"',
    (text) => expect(hasFirstPersonPlural(text)).toBe(false),
  );
});

describe('hasFirstPersonSingular', () => {
  it.each([
    'I sit next to her office',
    "I'm the only porter",
    "I've seen it twice",
    "I'd rather not say",
    "I'll send the logs",
    'she moved me to nights',
    'my locker on level 2',
    'the keys are mine',
    'I did it myself',
    'MY SHIFT STARTS AT 5',
    'im the only one on weekends',
    'ive been here a decade',
    'the gate, which I open',
  ])('finds the writer in "%s"', (text) => {
    expect(hasFirstPersonSingular(text)).toBe(true);
  });

  it.each([
    'He always leaves early',
    'the time clock',
    'a mystery shopper',
    'the admin login',
    'his theme park',
    'five drivers',
    'we all saw it',
    'our team of three',
  ])('finds no first-person singular token in "%s"', (text) => {
    expect(hasFirstPersonSingular(text)).toBe(false);
  });
});
