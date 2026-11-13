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
