import { consentToCloudScan } from '../../application/usecases/consentToCloudScan';
import { toRawText, type ConsentedRawText } from '../../domain/text/brandedText';

/**
 * Test only: consented text obtained the one legitimate way, through consentToCloudScan with
 * an acknowledged own-text consent (never by a type assertion).
 */
export function consentedText(text: string): ConsentedRawText {
  const result = consentToCloudScan(
    toRawText(text),
    { kind: 'own-text', acknowledged: true },
    { cloudScanEnabled: true },
  );
  if (!result.ok) throw new Error(result.error.kind);
  return result.value;
}
