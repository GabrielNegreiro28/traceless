import { describe, expect, it } from 'vitest';
import { filterThirdPerson, isThirdPersonFinding } from './thirdPersonFilter';
import type { Finding, FindingOrigin } from './types';

function finding(quote: string, origin: FindingOrigin = 'MODEL'): Finding {
  return {
    id: `${origin}:${quote}`,
    span: { start: 0, end: quote.length },
    quote,
    category: 'SCHEDULE',
    reason: 'r',
    suggestion: null,
    origin,
  };
}

describe('isThirdPersonFinding', () => {
  it.each([
    'He always leaves the night shift early',
    'she signs the safety checks herself',
    'They told the crew to stay quiet',
    "They've moved the stock twice",
    '"He said it was standard',
    '(she) approved every invoice',
  ])('matches a quote about someone else: "%s"', (quote) => {
    expect(isThirdPersonFinding(finding(quote))).toBe(true);
  });

  it.each([
    'She moved me to nights',
    "They're short-staffed so I cover Sundays",
    'He sits next to my desk',
    'I sit next to her office',
    'the only porter, he says',
    'Hence the weekend rota',
    'Theodore runs the late shift',
    'Shelly in payroll',
    'Their office on level 4',
    'They put only two of us on the overnight desk',
    'They moved our whole team to the annex',
    'She told us we were the only two cashiers',
  ])('keeps "%s"', (quote) => {
    expect(isThirdPersonFinding(finding(quote))).toBe(false);
  });

  it('never matches a RULE finding', () => {
    expect(isThirdPersonFinding(finding('He always leaves early', 'RULE'))).toBe(false);
  });
});

describe('filterThirdPerson', () => {
  it('splits findings into kept and suppressed, preserving order', () => {
    const findings = [
      finding('I work the first lifts'),
      finding('He signs the logbook'),
      finding('She moved me to nights'),
      finding('They pay in cash'),
    ];
    const result = filterThirdPerson(findings);
    expect(result.kept).toEqual([findings[0], findings[2]]);
    expect(result.suppressed).toEqual([findings[1], findings[3]]);
  });
});
