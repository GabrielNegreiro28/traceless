import { describe, expect, it } from 'vitest';
import type { ModelFinding } from '../../domain/detection/types';
import { toRawText } from '../../domain/text/brandedText';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeIdentityScanner } from '../../infrastructure/fakes/FakeIdentityScanner';
import { scanReport, type ScanReportDeps } from './scanReport';
import { fakeFinder, fakeVerifier } from './verifyCandidates.testKit';

/** Pipeline composition: the verify pass joins the scan passes before post-filters and merge. */

const FIRST =
  'I service the only hyperbaric chamber here. The registrar, Mr. Vossberg, bills twice.';
const SECOND = 'She shreds the logs. I park by the east gate.';
const TEXT = toRawText(`${FIRST}\n\n${SECOND}`);
const BOTH = ['protectedMentions', 'thirdPerson'] as const;

function mf(quote: string, category: ModelFinding['category']): ModelFinding {
  return { quote, category, reason: 'r', suggestion: null };
}

function scanner() {
  return new FakeIdentityScanner({
    respond: (chunk) =>
      chunk.includes('hyperbaric')
        ? {
            findings: [mf('the only hyperbaric chamber', 'ROLE_UNIQUE')],
            protectedQuotes: ['The registrar, Mr. Vossberg'],
          }
        : { findings: [] },
  });
}

function deps(extra: Partial<ScanReportDeps> = {}): ScanReportDeps {
  return {
    scanner: scanner(),
    clock: new FakeClock(0, 5),
    chunkChars: Math.max(FIRST.length, SECOND.length) + 2,
    postFilters: BOTH,
    rulePack: 'core',
    ...extra,
  };
}

const WRITER = { about: 'WRITER', category: 'LOCATION' } as const;

describe('scanReport with the verify pass', () => {
  it('without a verify pass behaves exactly as before (no candidates, no verifier)', async () => {
    const plain = await scanReport(TEXT, deps());
    const { verifier, calls } = fakeVerifier(() => WRITER);
    const empty = await scanReport(
      TEXT,
      deps({ disclosure: { finder: fakeFinder([]), verifier } }),
    );
    expect(calls).toEqual([]);
    expect(empty).toEqual(plain);
  });

  it('merges verified findings with the scan findings and counts them as model findings', async () => {
    const { verifier, calls } = fakeVerifier(() => WRITER);
    const finder = fakeFinder(['by the east gate']);
    const result = await scanReport(TEXT, deps({ disclosure: { finder, verifier } }));
    if (!result.ok) throw new Error(result.error.kind);
    expect(calls).toEqual([{ chunk: SECOND, candidates: ['by the east gate'] }]);
    expect(result.value.modelFindings.map((f) => f.quote)).toEqual([
      'the only hyperbaric chamber',
      'by the east gate',
    ]);
    expect(result.value.findings.map((f) => f.quote)).toEqual([
      'the only hyperbaric chamber',
      'by the east gate',
    ]);
    expect(result.value.stats).toMatchObject({ rawModelFindings: 2, locatedModelFindings: 2 });
  });

  it('runs the post-filters on verified findings: third person and protected mentions', async () => {
    const { verifier } = fakeVerifier(() => ({ about: 'WRITER', category: 'ROLE_UNIQUE' }));
    const finder = fakeFinder(['She shreds the logs', 'Mr. Vossberg, bills twice']);
    const result = await scanReport(TEXT, deps({ disclosure: { finder, verifier } }));
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.modelFindings.map((f) => f.quote)).toEqual(['the only hyperbaric chamber']);
    expect(result.value.stats.suppressed).toBe(2);
    expect(result.value.raw.modelFindings).toHaveLength(3);
  });

  it('fails the whole scan when a verification ran off the device', async () => {
    const { verifier } = fakeVerifier(() => WRITER, { source: 'IN_CLOUD' });
    const finder = fakeFinder(['by the east gate']);
    const result = await scanReport(TEXT, deps({ disclosure: { finder, verifier } }));
    expect(!result.ok && result.error.kind).toBe('PrivacyViolation');
  });
});
