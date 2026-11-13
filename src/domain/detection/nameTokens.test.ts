import { describe, expect, it } from 'vitest';
import { extractNameTokens, findTokenSpans, leadingRun } from './nameTokens';

describe('extractNameTokens', () => {
  it('takes the tokens after an honorific, without possessives', () => {
    expect(extractNameTokens("Dr. Jane Ruiz-Ortega's")).toEqual(['Jane', 'Ruiz-Ortega']);
    expect(extractNameTokens('Professor Ilse Marchetti')).toEqual(['Ilse', 'Marchetti']);
    expect(extractNameTokens('Coach Vantongeren')).toEqual(['Vantongeren']);
    expect(extractNameTokens('Mrs. Pell and Mr. Osei')).toEqual(['Pell', 'Osei']);
    expect(extractNameTokens("the shift lead, Mr. O'Hara")).toEqual(["O'Hara"]);
  });

  it.each([
    ['Site Manager Gary Holt', ['Gary', 'Holt']],
    ['Finance Director Mark Hill', ['Mark', 'Hill']],
    ['Night Supervisor Ana Cruz', ['Ana', 'Cruz']],
    ['Sister Jones on Ward 7', ['Jones']],
    ['Riverside Depot', []],
  ])('keeps only the person-name tokens of "%s"', (quote, names) => {
    expect(extractNameTokens(quote)).toEqual(names);
  });

  it('takes the last 1-2 tokens of the final run in a "[title], [Name]" introduction', () => {
    expect(extractNameTokens('The bursar of the club, Leopold Fairchild-Amadi')).toEqual([
      'Leopold',
      'Fairchild-Amadi',
    ]);
    expect(extractNameTokens('the porter, Osei')).toEqual(['Osei']);
    expect(extractNameTokens('Our CTO, Al Brisk')).toEqual(['Brisk']);
    expect(extractNameTokens('the McAllister-Byrne account')).toEqual(['McAllister-Byrne']);
  });

  it('gives nothing for runs without a person-name shape', () => {
    expect(extractNameTokens('The night auditor')).toEqual([]);
    expect(extractNameTokens('Someone in the Head Office')).toEqual([]);
    expect(extractNameTokens('Bertil Sandqvist from Accounts')).toEqual([]);
    expect(extractNameTokens('the lab guy')).toEqual([]);
  });
});

describe('leadingRun', () => {
  it('returns the opening capitalised run, skipping one honorific and possessives', () => {
    expect(leadingRun('Wade had the keys')).toEqual(['Wade']);
    expect(leadingRun('Mr. Wade knows')).toEqual(['Wade']);
    expect(leadingRun("Wade's office")).toEqual(['Wade']);
    expect(leadingRun('"Wade, again Tom')).toEqual(['Wade']);
    expect(leadingRun('Tom Alvarez works the only forklift')).toEqual(['Tom', 'Alvarez']);
    expect(leadingRun('Jordan Street branch')).toEqual(['Jordan', 'Street']);
    expect(leadingRun('the only Site Engineer')).toEqual([]);
    expect(leadingRun('  ')).toEqual([]);
  });
});

describe('findTokenSpans', () => {
  const text = 'Ann and Anna met Ann. ann left.';

  it('finds every word-bounded, case-sensitive occurrence', () => {
    expect(findTokenSpans(text, 'Ann')).toEqual([
      { start: 0, end: 3 },
      { start: 17, end: 20 },
    ]);
  });

  it('never matches inside a longer word or an empty token', () => {
    expect(findTokenSpans('Annabel', 'Ann')).toEqual([]);
    expect(findTokenSpans(text, '')).toEqual([]);
    expect(findTokenSpans('Joanna', 'Anna')).toEqual([]);
    expect(findTokenSpans("Anna's desk", 'Anna')).toEqual([{ start: 0, end: 4 }]);
  });
});
