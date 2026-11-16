import { describe, expect, expectTypeOf, it } from 'vitest';
import { SAMPLE_REPORT } from '../../domain/report/sampleReport';
import {
  sliceConsentedText,
  toRawText,
  type ConsentedRawText,
  type RawText,
} from '../../domain/text/brandedText';
import type { ConsentedIdentityScanner } from '../ports/ConsentedIdentityScanner';
import { consentToCloudScan, type CloudScanConsent } from './consentToCloudScan';

const ON = { cloudScanEnabled: true };
const OWN_TEXT: CloudScanConsent = { kind: 'own-text', acknowledged: true };
const SAMPLE: CloudScanConsent = { kind: 'sample' };
const MY_TEXT = toRawText('I am the only night nurse on ward 7.');

function consented(text: RawText, consent: CloudScanConsent): ConsentedRawText {
  const result = consentToCloudScan(text, consent, ON);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value;
}

describe('consentToCloudScan', () => {
  it('accepts the unmodified sample with a one-click sample consent', () => {
    expect(consented(toRawText(SAMPLE_REPORT), SAMPLE)).toBe(SAMPLE_REPORT);
  });

  it.each([
    ['one extra character', `${SAMPLE_REPORT}.`],
    ['one character changed', `X${SAMPLE_REPORT.slice(1)}`],
    ['one character removed', SAMPLE_REPORT.slice(0, -1)],
    ['trailing whitespace', `${SAMPLE_REPORT} `],
  ])('refuses a sample consent for text that differs by %s', (_name, text) => {
    const result = consentToCloudScan(toRawText(text), SAMPLE, ON);
    expect(result).toMatchObject({ ok: false, error: { kind: 'ConsentRequired' } });
  });

  it("accepts the reporter's own text only with an acknowledged consent", () => {
    expect(consented(MY_TEXT, OWN_TEXT)).toBe(MY_TEXT);
    const unacknowledged = { kind: 'own-text', acknowledged: false } as unknown as CloudScanConsent;
    expect(consentToCloudScan(MY_TEXT, unacknowledged, ON)).toMatchObject({
      ok: false,
      error: { kind: 'ConsentRequired' },
    });
  });

  it.each([undefined, null, {}, { kind: 'everything' }, 'yes', true])(
    'refuses a missing or malformed consent (%o)',
    (consent) => {
      const result = consentToCloudScan(MY_TEXT, consent as unknown as CloudScanConsent, ON);
      expect(result).toMatchObject({ ok: false, error: { kind: 'ConsentRequired' } });
    },
  );

  it('refuses everything while the kill switch is off', () => {
    const off = { cloudScanEnabled: false };
    for (const [text, consent] of [
      [toRawText(SAMPLE_REPORT), SAMPLE],
      [MY_TEXT, OWN_TEXT],
    ] as const) {
      expect(consentToCloudScan(text, consent, off)).toMatchObject({
        ok: false,
        error: { kind: 'CloudScanDisabled' },
      });
    }
  });

  it('refuses a blank text', () => {
    expect(consentToCloudScan(toRawText('  \n'), OWN_TEXT, ON)).toMatchObject({
      ok: false,
      error: { kind: 'EmptyReport' },
    });
  });

  it('never puts the text in its error messages', () => {
    const results = [
      consentToCloudScan(MY_TEXT, undefined as unknown as CloudScanConsent, ON),
      consentToCloudScan(MY_TEXT, OWN_TEXT, { cloudScanEnabled: false }),
    ];
    for (const result of results) {
      if (result.ok) throw new Error('expected a refusal');
      expect(result.error.message).not.toContain('night nurse');
      expect(Object.keys(result.error).sort()).toEqual(['kind', 'message']);
    }
  });

  it('slices of consented text stay consented and keep their characters', () => {
    const text = consented(MY_TEXT, OWN_TEXT);
    const part = sliceConsentedText(text, 9, 31);
    expect(part).toBe('only night nurse on wa');
    expectTypeOf(part).toEqualTypeOf<ConsentedRawText>();
  });
});

// Compile-time guarantees, checked by `npm run typecheck` (tsc covers test files).
describe('consented text (type level)', () => {
  it('returns ConsentedRawText, which is not RawText or a plain string to create', () => {
    expectTypeOf(consentToCloudScan).returns.toExtend<{ ok: boolean }>();
    expectTypeOf<ConsentedRawText>().not.toEqualTypeOf<RawText>();
  });

  it('rejects RawText wherever consented text is required', () => {
    const scanner: ConsentedIdentityScanner = {
      scan: () => Promise.resolve({ ok: true, value: emptyScan() }),
    };
    // @ts-expect-error raw text must go through consentToCloudScan() first
    void scanner.scan(MY_TEXT);
    // @ts-expect-error a plain string is not consented text either
    void scanner.scan('plain text');
    // @ts-expect-error RawText cannot be sliced into consented text
    sliceConsentedText(MY_TEXT, 0, 1);
    expect(true).toBe(true);
  });

  it('requires an explicit acknowledgement in an own-text consent', () => {
    // @ts-expect-error `acknowledged: true` is required
    const missing: CloudScanConsent = { kind: 'own-text' };
    // @ts-expect-error only `true` acknowledges
    const refused: CloudScanConsent = { kind: 'own-text', acknowledged: false };
    expect([missing, refused]).toHaveLength(2);
  });
});

function emptyScan() {
  return { findings: [], protectedQuotes: [], source: 'IN_CLOUD' as const, retries: 0 };
}
