/**
 * Branded text types that encode the privacy class of a string (PLANO §1.4).
 *
 * - RawText: what the reporter typed. Never leaves the device.
 * - ConsentedRawText: raw text the reporter explicitly agreed to send to the
 *   cloud for scanning (only when on-device AI is unavailable).
 * - SanitizedText: text the reporter reviewed and approved. The only class
 *   that cloud adapters accept.
 *
 * The brands exist only at compile time; at runtime all three are plain strings.
 */
declare const textBrand: unique symbol;

type Branded<B extends string> = string & { readonly [textBrand]: B };

export type RawText = Branded<'RawText'>;
export type ConsentedRawText = Branded<'ConsentedRawText'>;
export type SanitizedText = Branded<'SanitizedText'>;

/** Marks user input as raw (sensitive) text. */
export function toRawText(value: string): RawText {
  return value as RawText;
}

/**
 * INTERNAL FACTORY. Only `src/application/usecases/approveReport.ts` may call this
 * (enforced by an ESLint `no-restricted-imports` rule). Creating SanitizedText
 * anywhere else would bypass the reporter's explicit approval.
 */
export function unsafeCreateSanitizedText(value: string): SanitizedText {
  return value as SanitizedText;
}

/**
 * INTERNAL FACTORY. Only `src/application/usecases/consentToCloudScan.ts` may call this
 * (enforced by an ESLint `no-restricted-imports` rule). Creating ConsentedRawText anywhere
 * else would send raw text to the cloud without the reporter's explicit, per-scan consent.
 */
export function unsafeCreateConsentedRawText(value: string): ConsentedRawText {
  return value as ConsentedRawText;
}

/**
 * A part of consented text is still consented text (the cloud scan sends the report in
 * chunks). It accepts only ConsentedRawText, so it can narrow an existing consent to a
 * substring but never create one from RawText or a plain string.
 */
export function sliceConsentedText(
  text: ConsentedRawText,
  start: number,
  end: number,
): ConsentedRawText {
  return text.slice(start, end) as ConsentedRawText;
}
