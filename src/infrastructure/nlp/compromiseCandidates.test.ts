import { describe, expect, it } from 'vitest';
import type { Candidate } from '../../domain/detection/candidates/candidateTypes';
import { spansMatch } from '../../domain/evaluation/matching';
import { toRawText } from '../../domain/text/brandedText';
import { CompromiseCandidateFinder } from './compromiseCandidates';

/** Invented sentences only (never evaluation data). */
const finder = new CompromiseCandidateFinder();

async function candidates(text: string): Promise<Candidate[]> {
  const result = await finder.find(toRawText(text));
  if (!result.ok) throw new Error(result.error.kind);
  return result.value;
}

async function covers(text: string, phrase: string): Promise<boolean> {
  const start = text.indexOf(phrase);
  if (start === -1) throw new Error('phrase not in text');
  const span = { start, end: start + phrase.length };
  return (await candidates(text)).some((c) => spansMatch(c.span, span));
}

describe('CompromiseCandidateFinder: pattern families', () => {
  it.each([
    ['possessive phrase', 'Our depot on the north road ships late.', 'Our depot on the north road'],
    ['possessive phrase', 'I keep the keys for my evening rounds.', 'my evening rounds'],
    [
      'first-person clause',
      'I calibrate the pressure gauges for the whole plant.',
      'I calibrate the pressure gauges',
    ],
    [
      'first-person clause',
      "I'm usually the only welder on the late crew.",
      'the only welder on the late crew',
    ],
    [
      'temporal clause',
      'The month I returned from surgery, the audits stopped.',
      'The month I returned from surgery',
    ],
    [
      'temporal clause',
      'Ever since I joined the archive team, files go missing.',
      'since I joined the archive team',
    ],
    ['time range', 'I usually sit at the gate between eleven and four.', 'between eleven and four'],
    ['time phrase', 'We restock the pharmacy shelves every Thursday.', 'every Thursday'],
    ['place phrase', 'I sort parcels in the basement mailroom.', 'in the basement mailroom'],
    [
      'writer object',
      'Most of the new hires come to me with payroll questions.',
      'come to me with payroll questions',
    ],
    ['writer object', 'There are only three of us in the lab.', 'only three of us in the lab'],
    ['opening time phrase', 'In the winter, I was moved to the loading dock.', 'In the winter'],
    ['closing line', 'I hope this is enough to start an inquiry.\n\nCheers,\nRobin K.', 'Robin K.'],
  ])('%s: finds the invented detail', async (_family, text, phrase) => {
    expect(await covers(text, phrase)).toBe(true);
  });

  it('returns exact slices of the text in position order', async () => {
    const text = 'Since my transfer, I run the night desk on the third floor every Sunday.';
    const found = await candidates(text);
    expect(found.length).toBeGreaterThan(0);
    for (const c of found) expect(text.slice(c.span.start, c.span.end)).toBe(c.quote);
    const starts = found.map((c) => c.span.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});

describe('CompromiseCandidateFinder: negatives', () => {
  it.each([
    ['third-person action', 'He leaves at five every day through the back door.'],
    ['third-person duty', 'She maintains the server room on the second floor.'],
    ['quoted speech', 'The foreman shouted "I run this yard at night" and walked off.'],
    ['reported speech', 'He told the crew: I am the only one who checks the vault.'],
    ['someone else named', 'Our site director, Alma Reyes, signs every invoice.'],
    ['someone else by role', 'My supervisor wants the numbers changed.'],
    ['framing verb', 'I think the reports were altered.'],
  ])('%s: proposes nothing', async (_case, text) => {
    expect(await candidates(text)).toEqual([]);
  });

  it('skips the third-person clause of a mixed sentence', async () => {
    const text = 'I file the cargo manifests, and he leaves at five through the side gate.';
    expect(await covers(text, 'I file the cargo manifests')).toBe(true);
    expect(await covers(text, 'he leaves at five')).toBe(false);
    expect(await covers(text, 'through the side gate')).toBe(false);
  });
});

describe('CompromiseCandidateFinder: failures', () => {
  it('maps a failing tagger load to an AppError and retries the load next time', async () => {
    let calls = 0;
    const failing = new CompromiseCandidateFinder(() => {
      calls += 1;
      return Promise.reject(new Error('chunk load failed'));
    });
    const first = await failing.find(toRawText('I work nights.'));
    await failing.find(toRawText('I work nights.'));
    expect(first.ok).toBe(false);
    expect(calls).toBe(2);
  });

  it('rejects tagger output of an unexpected shape', async () => {
    const odd = new CompromiseCandidateFinder(() => Promise.resolve(() => ({ nope: true })));
    const result = await odd.find(toRawText('I work nights.'));
    expect(result.ok ? null : result.error.kind).toBe('Unknown');
  });
});
