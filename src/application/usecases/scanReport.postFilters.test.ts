import { describe, expect, it } from 'vitest';
import type { PostFilterName } from '../../domain/detection/postFilters';
import type { Finding, ModelFinding } from '../../domain/detection/types';
import { toRawText } from '../../domain/text/brandedText';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import {
  FakeIdentityScanner,
  type FakeScanStep,
} from '../../infrastructure/fakes/FakeIdentityScanner';
import { scanReport } from './scanReport';

const BARE = 'Quennell-Ashby signs every cheque alone, qa@club.example.';
const INTRO = 'The bursar, Ms. Quennell-Ashby, pays herself twice.';
const MINE = 'I keep the boathouse keys on weekends.';
const THEY = 'He moves the money at night.';
const BOTH = ['protectedMentions', 'thirdPerson'] as const;

function mf(quote: string, category: ModelFinding['category'] = 'ROLE_UNIQUE'): ModelFinding {
  return { quote, category, reason: 'r', suggestion: null };
}

/** The bare mention comes first: only the LAST chunk introduces the reported person. */
function respond(chunk: string): FakeScanStep {
  if (chunk.includes('signs every cheque')) {
    return { findings: [mf('Quennell-Ashby signs every cheque', 'DIRECT_IDENTIFIER')] };
  }
  if (chunk.includes('boathouse')) {
    return { findings: [mf('I keep the boathouse keys', 'SCHEDULE'), mf('He moves the money')] };
  }
  return {
    findings: [mf('The bursar, Ms. Quennell-Ashby')],
    protectedQuotes: ['The bursar, Ms. Quennell-Ashby'],
  };
}

async function scan(postFilters?: readonly PostFilterName[]) {
  const text = toRawText([BARE, `${MINE} ${THEY}`, INTRO].join('\n\n'));
  const scanner = new FakeIdentityScanner({ respond: (c) => respond(c) });
  const deps = { scanner, clock: new FakeClock(0, 5), chunkChars: 70 };
  const result = await scanReport(
    text,
    postFilters === undefined ? deps : { ...deps, postFilters },
  );
  if (!result.ok) throw new Error(result.error.kind);
  expect(scanner.chunks).toHaveLength(3);
  return { text, value: result.value };
}

const quotes = (findings: readonly Finding[]) => findings.map((f) => f.quote);

describe('scanReport post-filters', () => {
  it('collects protected quotes from every chunk before filtering (cross-chunk)', async () => {
    const { value } = await scan(BOTH);
    expect(quotes(value.modelFindings)).toEqual(['I keep the boathouse keys']);
    expect(value.stats.suppressed).toBe(3);
    expect(value.stats.locatedModelFindings).toBe(4);
  });

  it('ships rule findings plus filtered model findings; keeps the raw view intact', async () => {
    const { value } = await scan(BOTH);
    expect(quotes(value.findings)).toEqual(['qa@club.example', 'I keep the boathouse keys']);
    expect(value.findings[0]?.origin).toBe('RULE');
    expect(quotes(value.raw.modelFindings)).toEqual([
      'Quennell-Ashby signs every cheque',
      'I keep the boathouse keys',
      'He moves the money',
      'The bursar, Ms. Quennell-Ashby',
    ]);
    expect(value.raw.findings).toHaveLength(5);
  });

  it('returns where the protected people are mentioned', async () => {
    const { text, value } = await scan(BOTH);
    expect(value.protectedSpans.map((s) => text.slice(s.start, s.end))).toEqual([
      'Quennell-Ashby',
      'The bursar, Ms. Quennell-Ashby',
    ]);
  });

  it('changes nothing when no filter is enabled', async () => {
    const { value } = await scan();
    expect(value.findings).toEqual(value.raw.findings);
    expect(value.modelFindings).toEqual(value.raw.modelFindings);
    expect(value.protectedSpans).toEqual([]);
    expect(value.stats.suppressed).toBe(0);
  });
});
