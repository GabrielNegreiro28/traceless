import { describe, expect, it } from 'vitest';
import { isInReportedSpeech, isInsideQuote } from './firstPersonSpeech';

/** The offset of the first "I"/"we" anchor after the marker `^`, with the marker removed. */
function at(marked: string): [string, number] {
  const offset = marked.indexOf('^');
  return [marked.replace('^', ''), offset];
}

describe('isInsideQuote', () => {
  it.each([
    ['The warden yelled "^I run the kiln."'],
    ['The warden yelled “^I run the kiln.”'],
    ["The glazier said '^we light it at dawn'"],
    ['The glazier said ‘^we light it at dawn’'],
    ['The glazier wrote "Fine. ^I run the kiln."'],
  ])('sees an open quotation in %s', (marked) => {
    expect(isInsideQuote(...at(marked))).toBe(true);
  });

  it.each([
    ['^I run the kiln.'],
    ['The warden yelled "stop" and ^I left.'],
    ['The warden yelled “stop” and ^I left.'],
    ["I'm sure the glazier's kiln isn't mine, and ^I said so."],
    ["The glaziers' kiln was cold when ^I arrived."],
    ['The warden yelled "stop".\n^I left the kiln.'],
  ])('sees no open quotation in %s', (marked) => {
    expect(isInsideQuote(...at(marked))).toBe(false);
  });
});

describe('isInReportedSpeech', () => {
  it('rejects an anchor after a speech verb and a colon in the same sentence', () => {
    expect(isInReportedSpeech(...at('The warden told everyone: ^I run the kiln.'))).toBe(true);
  });

  it('keeps an anchor after the sentence that reported the speech', () => {
    expect(isInReportedSpeech(...at('The warden told everyone: stop. ^I run the kiln.'))).toBe(
      false,
    );
  });

  it('keeps an anchor after a colon without a speech verb', () => {
    expect(isInReportedSpeech(...at('Kilns: ^I run three of them.'))).toBe(false);
  });
});
