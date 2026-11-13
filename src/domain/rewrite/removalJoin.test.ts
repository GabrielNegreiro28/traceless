import { describe, expect, it } from 'vitest';
import { joinAroundRemoval } from './removalJoin';

describe('joinAroundRemoval', () => {
  it.each([
    ['collapses the double space in mid-sentence', 'Call me at ', ' today', 'Call me at today'],
    ['keeps a period that followed the removal', 'Email me at ', '.', 'Email me at.'],
    ['drops the leading space at the start of the text', '', ' is my number.', 'is my number.'],
    ['drops the trailing space at the end of the text', 'My number is ', '', 'My number is'],
    [
      'collapses doubled commas',
      'I work nights, ',
      ', and I saw it',
      'I work nights, and I saw it',
    ],
    ['prefers the closing punctuation over a comma', 'I work nights, ', '.', 'I work nights.'],
    ['collapses a colon before a period', 'Contact: ', '.', 'Contact.'],
    ['drops an emptied bracket pair', 'Ask me (', ') later', 'Ask me later'],
    ['drops an emptied square bracket pair', 'Ref [', '] here', 'Ref here'],
    ['keeps non-empty brackets', 'Ask me (', ' or later)', 'Ask me (or later)'],
    ['keeps a newline before the removal', 'Line one.\n', ' Next line', 'Line one.\nNext line'],
    ['keeps a newline after the removal', 'Line one ', '\nNext', 'Line one\nNext'],
    ['trims tabs like spaces', 'a\t', '\tb', 'a b'],
    ['handles both sides empty', '', '', ''],
    ['keeps a space between two words', 'night', 'shift', 'night shift'],
    ['handles a comma with spaces before it', 'nights ,', ', and', 'nights, and'],
    ['drops a comma left at the start of the text', '', ', my boss, said hi', 'my boss, said hi'],
    ['drops a comma left at the start of a line', 'Line one.\n', ', said hi', 'Line one.\nsaid hi'],
    ['drops a period left at the start of the text', '', '. Then…', 'Then…'],
    ['drops emptied straight quotes at the start', '"', '" said', 'said'],
    ['drops emptied straight quotes before a period', 'met "', '".', 'met.'],
    ['drops emptied single quotes', "called '", "' twice", 'called twice'],
    ['drops emptied curly quotes', 'called “', '” twice', 'called twice'],
    ['collapses emptied parenthetical dashes', 'He --', '-- said', 'He said'],
    ['collapses emptied em dashes', 'He —', '— said', 'He said'],
    ['handles a bare dash pair', '--', '--', ''],
  ])('%s', (_name, left, right, expected) => {
    expect(joinAroundRemoval(left, right)).toBe(expected);
  });

  it('never leaves a double space or a space before punctuation', () => {
    const out = joinAroundRemoval('We met at ', ' , then left.');
    expect(out).not.toMatch(/ {2}| [,.]/);
    expect(out).toBe('We met at, then left.');
  });
});
