import { describe, expect, it } from 'vitest';
import { toRawText } from '../text/brandedText';
import { detectByRules } from './ruleDetector';

function quotes(text: string): string[] {
  return detectByRules(toRawText(text)).map((f) => f.quote);
}

describe('detectByRules: identifiers', () => {
  it('finds emails', () => {
    const found = detectByRules(toRawText('Write me at jane.doe+x@mail.example.com now.'));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      quote: 'jane.doe+x@mail.example.com',
      category: 'DIRECT_IDENTIFIER',
      origin: 'RULE',
      id: 'rule:12-39',
      span: { start: 12, end: 39 },
    });
  });

  it('finds urls and strips trailing punctuation', () => {
    expect(quotes('See https://example.com/a/b?x=1, and www.corp.example.org.')).toEqual([
      'https://example.com/a/b?x=1',
      'www.corp.example.org',
    ]);
  });

  it.each([
    '+1 415 555 0132',
    '+44 20 7946 0958',
    '(415) 555-0132',
    '(415)555-0132',
    '415-555-0132',
    '4155550132',
    '555-0132',
    '030 1234567',
  ])('finds phone %s', (input) => {
    expect(quotes(`Call ${input} please`)).toEqual([input]);
  });

  it.each([
    'from 555-0132 to HR',
    'I called HR from 555-0132.',
    'send it to 555-0132',
    'forward to 555-0132',
    'He calls from 555-0132 every night',
    'My number is 555-0132 days or nights',
  ])('still finds the phone in "%s"', (input) => {
    expect(quotes(input)).toEqual(['555-0132']);
  });

  it('does not treat money, years, short numbers or case numbers as phones', () => {
    expect(quotes('I was underpaid $4,500 in 2019 across 12 weeks, room 4471.')).toEqual([]);
    expect(quotes('Total was 1,234,567 units')).toEqual([]);
    expect(quotes('Case 2025-0412 was filed')).toEqual([]);
    expect(quotes('Sold 300-4000 units')).toEqual([]);
    expect(quotes('see pages 120-1450')).toEqual([]);
    expect(quotes('about 300-4000 people')).toEqual([]);
  });

  it.each([
    ['my employee ID 48213 was used', 'employee ID 48213'],
    ['badge #4471 swiped', 'badge #4471'],
    ['Staff number: AB-12345 here', 'Staff number: AB-12345'],
    ['The form said ID: AB-12345.', 'ID: AB-12345'],
    ['Case ID: 2025-0412 closed', 'ID: 2025-0412'],
    ['staff AB1234 logged in', 'staff AB1234'],
  ])('finds id in "%s"', (input, expected) => {
    expect(quotes(input)).toEqual([expected]);
  });

  it('does not flag ID words without a label or number', () => {
    expect(quotes('The employee was rude and the ID check was skipped.')).toEqual([]);
    expect(quotes('the staff 2019 holiday party')).toEqual([]);
    expect(quotes('personnel 2024 review')).toEqual([]);
  });

  it('keeps overlapping matches from different rules (merger resolves them)', () => {
    const found = quotes('employee ID: AB-12345');
    expect(found).toContain('employee ID: AB-12345');
    expect(found).toContain('ID: AB-12345');
  });
});

describe('detectByRules: dates', () => {
  it.each([
    ['It happened on March 3.', 'March 3'],
    ['It happened on Sept. 12th, 2025 late.', 'Sept. 12th, 2025'],
    ['On 3 March 2026 he left.', '3 March 2026'],
    ['On the 5th of May we met.', '5th of May'],
    ['Dated 03/14/2026 exactly.', '03/14/2026'],
    ['Dated 14/03/26 exactly.', '14/03/26'],
    ['Dated 14.03.2026 exactly.', '14.03.2026'],
    ['Dated 2026-03-14 exactly.', '2026-03-14'],
    ['He left on 12/03 without notice.', '12/03'],
    ['On 12/03 the supervisor fired me', '12/03'],
    ['On 3/4 the manager yelled', '3/4'],
    ['Since 4/5 the line has been closed', '4/5'],
  ])('finds date in "%s"', (input, expected) => {
    const found = detectByRules(toRawText(input));
    expect(found.map((f) => f.quote)).toEqual([expected]);
    expect(found[0]?.category).toBe('PERSONAL_EVENT_DATE');
  });

  it('does not flag versions, ratings, sections, IPs or fractions as dates', () => {
    for (const text of [
      'version 2.10.15 shipped',
      'rated it 9.5/10',
      'Section 12.3.14 applies',
      'host 10.10.10.10 is down',
      'I scored 9/10',
      'on 3/4 of the days',
      'from 9/10 people',
      'ratio 2026-13-45',
    ]) {
      expect(quotes(text)).toEqual([]);
    }
  });

  it('does not flag a bare year, month word or lowercase "may"', () => {
    expect(quotes('Since 2019 this has gone on. It may 5 times worse; in March it grew.')).toEqual(
      [],
    );
  });

  it('KNOWN LIMITATION: "In May 12 people quit" is read as the date "May 12"', () => {
    expect(quotes('In May 12 people quit')).toEqual(['May 12']);
  });
});

describe('detectByRules: general behaviour', () => {
  it('does not touch the accused name or incident facts', () => {
    expect(quotes('Mr. John Smith shouted at the team and falsified the safety log.')).toEqual([]);
  });

  it('returns findings sorted by position with unique ids', () => {
    const found = detectByRules(toRawText('a@b.co on March 3, call 415-555-0132'));
    const starts = found.map((f) => f.span.start);
    expect(starts).toEqual([...starts].sort((x, y) => x - y));
    expect(new Set(found.map((f) => f.id)).size).toBe(found.length);
  });

  it('is repeatable (no shared regex state between calls)', () => {
    const text = toRawText('a@b.co and c@d.org on March 3 and March 4');
    expect(detectByRules(text)).toEqual(detectByRules(text));
    expect(detectByRules(text)).toHaveLength(4);
  });

  it('returns empty for empty text', () => {
    expect(quotes('')).toEqual([]);
  });
});

describe('detectByRules: performance (ReDoS regression)', () => {
  const LIMIT_MS = 200;
  const hostile: ReadonlyArray<readonly [string, string]> = [
    ['10k whitespace', ' '.repeat(10_000)],
    ['10k newlines', '\n'.repeat(10_000)],
    ['label then 4k spaces', 'employee' + ' '.repeat(4000) + 'x'],
    ['20k letters', 'a'.repeat(20_000)],
    ['20k digits', '1'.repeat(20_000)],
    ['20k email-ish', 'a@'.repeat(10_000)],
    ['5k www.', 'www.'.repeat(5_000)],
    ['20k dots', '.'.repeat(20_000)],
    ['20k digit-dash', '1-'.repeat(10_000)],
    ['repeated labels', 'badge '.repeat(3_000)],
    ['20k slashes and digits', '1/'.repeat(10_000)],
  ];

  it.each(hostile)('stays fast on %s', (_name, input) => {
    const t0 = performance.now();
    detectByRules(toRawText(input));
    expect(performance.now() - t0).toBeLessThan(LIMIT_MS);
  });
});
