import { toRawText, type SanitizedText } from '../../domain/text/brandedText';
import { approveReport } from './approveReport';

/** SanitizedText for tests, created the only legal way: approving text with no findings. */
export function approvedText(text: string): SanitizedText {
  const result = approveReport(
    { text: toRawText(text), findings: [], decisions: [], acknowledgedRemainingRisk: false },
    { clock: { now: () => 0 } },
  );
  if (!result.ok) throw new Error('test approval failed');
  return result.value.text;
}

/** A deterministic "random" source: byte i = (seed + i) mod 256. */
export function seededBytes(seed: number): (length: number) => Uint8Array {
  return (length) => Uint8Array.from({ length }, (_, i) => (seed + i) % 256);
}
