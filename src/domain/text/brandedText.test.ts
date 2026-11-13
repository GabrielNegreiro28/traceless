import { assertType, describe, expect, expectTypeOf, it } from 'vitest';
import { toRawText, type ConsentedRawText, type RawText, type SanitizedText } from './brandedText';

describe('toRawText', () => {
  it('keeps the string value unchanged at runtime', () => {
    expect(toRawText('I work the night shift.')).toBe('I work the night shift.');
  });

  it('returns a RawText', () => {
    expectTypeOf(toRawText('x')).toEqualTypeOf<RawText>();
  });
});

// Compile-time guarantees, checked by `npm run typecheck` (tsc covers test files).
describe('privacy brands (type level)', () => {
  it('rejects a plain string where SanitizedText is required', () => {
    // @ts-expect-error a plain string is not SanitizedText
    assertType<SanitizedText>('plain text');
  });

  it('rejects RawText where SanitizedText is required', () => {
    // @ts-expect-error RawText must go through approveReport() first
    assertType<SanitizedText>(toRawText('raw'));
  });

  it('rejects ConsentedRawText where SanitizedText is required', () => {
    expectTypeOf<ConsentedRawText>().not.toExtend<SanitizedText>();
  });

  it('rejects RawText where ConsentedRawText is required', () => {
    expectTypeOf<RawText>().not.toExtend<ConsentedRawText>();
  });

  it('still lets every brand be read as a string', () => {
    expectTypeOf<SanitizedText>().toExtend<string>();
    expectTypeOf<RawText>().toExtend<string>();
    expectTypeOf<ConsentedRawText>().toExtend<string>();
  });
});
