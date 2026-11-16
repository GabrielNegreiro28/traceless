import { describe, expect, it } from 'vitest';
import { SAMPLE_REPORT } from '../report/sampleReport';
import { toRawText } from '../text/brandedText';
import { detectByRules } from './ruleDetector';
import { detectSignOff } from './signOffRule';

const BODY = 'The forklift checks are signed without anyone looking at the brakes.';

function signOff(text: string): string[] {
  return detectSignOff(text).map((f) => f.quote);
}

describe('detectSignOff: positives', () => {
  it.each([
    [`${BODY}\n\nImre V., packer`, 'Imre V., packer'],
    [`${BODY}\n— K.L.`, 'K.L.'],
    [`${BODY}\n-- Wen Hsu`, 'Wen Hsu'],
    [`${BODY}\n\n- Wen Hsu`, 'Wen Hsu'],
    [`${BODY}\nRegards,\nPriya`, 'Priya'],
    [`${BODY}\n\nBest regards,\nT. Brandvold`, 'T. Brandvold'],
    [`${BODY}\nSincerely,\nNadia Ferreira-Holm`, 'Nadia Ferreira-Holm'],
    [`${BODY}\nThanks,\nA.J.`, 'A.J.'],
    [`${BODY}\n— A. Brandvold`, 'A. Brandvold'],
    [`${BODY}\n\nMary Ann Lindgren`, 'Mary Ann Lindgren'],
    [`${BODY}\r\n\r\nImre V., packer\r\n  `, 'Imre V., packer'],
  ])('flags the sign-off of %j', (text, quote) => {
    expect(signOff(text)).toEqual([quote]);
  });

  it('returns a RULE DIRECT_IDENTIFIER finding whose span is the quote', () => {
    const text = `${BODY}\n\nImre V., packer\n`;
    const [finding] = detectSignOff(text);
    expect(finding).toMatchObject({
      category: 'DIRECT_IDENTIFIER',
      origin: 'RULE',
      suggestion: null,
    });
    const start = text.indexOf('Imre');
    expect(finding!.span).toEqual({ start, end: start + 'Imre V., packer'.length });
    expect(finding!.id).toBe(`rule:${start}-${finding!.span.end}`);
  });
});

describe('detectSignOff: hard negatives', () => {
  it.each([
    `${BODY}\n\nThank you.`,
    `${BODY}\n\nPlease investigate.`,
    `${BODY}\n\nBest regards.`,
    `${BODY}\n\nBest regards,`,
    `${BODY}\n\nSo did I.`,
    `${BODY}\n\nThank you, Ms. Jones`,
    `${BODY}\nSincerely,\nA Concerned Employee`,
    `${BODY}\n\nI hope Marta Lindqvist reads this one soon`,
    `${BODY}\nItems:\n- the ledger\n- Harbor Logs`,
    `${BODY}\nNadia Ferreira-Holm`,
    `${BODY}\n\nStaff ID: QX-88120`,
    `${BODY}\n\nP.S. Check Building C.`,
    `${BODY}\n\nPS Ask Wen Hsu`,
    `${BODY}\n\nStay safe, Everyone`,
    `${BODY}\n\nPlease Help Us Now`,
    `${BODY}\n\nIT Department`,
    `${BODY}\n— Payroll Team`,
    `${BODY}\nRegards,\nAnonymous`,
    `${BODY}\nThanks,\nAll`,
    'Priya told me the code',
    '  \n ',
    '',
  ])('does not flag %j', (text) => {
    expect(signOff(text)).toEqual([]);
  });

  it('KNOWN MISS: a bare one-word name after a blank line (indistinguishable from a word)', () => {
    expect(signOff(`${BODY}\n\nMarco`)).toEqual([]);
  });
});

describe('detectSignOff: self-description signatures', () => {
  it('flags the sample report signature (regression: nothing flagged it)', () => {
    const tail = 'the tired trainer on the night shift';
    const [finding] = detectSignOff(SAMPLE_REPORT);
    expect(finding).toMatchObject({ quote: tail, category: 'DIRECT_IDENTIFIER', origin: 'RULE' });
    expect(finding!.span.start).toBe(SAMPLE_REPORT.length - tail.length);
  });

  it.each([
    [
      `${BODY}\nThanks for listening,\nthe tired trainer on the night shift`,
      'the tired trainer on the night shift',
    ],
    [
      `${BODY}\nThank you for your time,\nThe Dock 4 forklift trainer`,
      'The Dock 4 forklift trainer',
    ],
    [`${BODY}\nRegards,\nyour night-shift packer`, 'your night-shift packer'],
    [
      `${BODY}\nCheers,\nan agency worker on the weekend shift`,
      'an agency worker on the weekend shift',
    ],
    [`${BODY}\n— the only electrician at the depot`, 'the only electrician at the depot'],
  ])('flags the self-description in %j', (text, quote) => {
    expect(signOff(text)).toEqual([quote]);
  });

  it.each([
    `${BODY}\nThanks for listening,\nAnonymous`,
    `${BODY}\nThanks for listening,\nthe operations manager Gary Pemberton`,
    `${BODY}\nThank you,\nthe manager knows what he did`,
    `${BODY}\nSincerely,\nA Concerned Employee`,
    `${BODY}\nThanks,\nthe whole night shift team`,
    `${BODY}\nThanks for listening,\na person who cares`,
    `${BODY}\n\nthe tired trainer on the night shift`,
    `${BODY}\nThanks for listening,\nthe trainer who saw everything on the night of 14 March`,
  ])('does not flag %j', (text) => {
    expect(signOff(text)).toEqual([]);
  });
});

describe('detectByRules with the sign-off rule', () => {
  it('adds the sign-off to the other rule findings, sorted', () => {
    const text = toRawText(`Mail me at imre@crate.example.\n\nImre V., packer`);
    expect(detectByRules(text).map((f) => [f.quote, f.category, f.origin])).toEqual([
      ['imre@crate.example', 'DIRECT_IDENTIFIER', 'RULE'],
      ['Imre V., packer', 'DIRECT_IDENTIFIER', 'RULE'],
    ]);
  });
});
