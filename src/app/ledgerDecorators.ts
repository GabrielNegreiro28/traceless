import type { Clock } from '../application/ports/Clock';
import type {
  LedgerSource,
  PrivacyLedger,
  PrivacyLedgerView,
} from '../application/ports/PrivacyLedger';
import type { ScanReportResult } from '../application/usecases/scanReport';
import type { Services } from './compositionRoot';

/**
 * Privacy-ledger decorators (design plan §1). The composition root wraps the use cases with
 * these, so every successful scan and approval is recorded and features can neither forget
 * nor fake an entry (they only ever receive the read-only view). Entries carry no text.
 */

/** Which scanner backs scanReport: Chrome's on-device model, or the deterministic demo fake. */
export type ScannerKind = 'onDevice' | 'demo';

/**
 * Where a successful scan ran. The real source is the runtime signal that reaches the result:
 * `ScanReportResult.source`, mapped by the adapter from the SDK's `inferenceSource`. scanReport
 * fails closed (PrivacyViolation) when any chunk ran off-device without consent, and the
 * on-device model is ONLY_ON_DEVICE, so a successful scan here reads `onDevice`; `cloud` is
 * kept for the consented cloud scan. The demo scanner is never reported as on-device AI.
 */
function scanSource(result: ScanReportResult, kind: ScannerKind): LedgerSource {
  if (kind === 'demo') return 'local';
  return result.source === 'ON_DEVICE' ? 'onDevice' : 'cloud';
}

/** Records one RAW identityScan entry per successful scan; failures record nothing. */
export function withScanLedger(
  scan: Services['scanReport'],
  ledger: PrivacyLedger,
  clock: Clock,
  kind: ScannerKind,
): Services['scanReport'] {
  return async (text, onProgress, isCancelled) => {
    const result = await scan(text, onProgress, isCancelled);
    if (result.ok) {
      const source = scanSource(result.value, kind);
      ledger.record({
        task: 'identityScan',
        source,
        dataClass: 'RAW',
        demo: kind === 'demo',
        at: clock.now(),
      });
    }
    return result;
  };
}

/** Records one SANITIZED approve entry per successful approval (plain code on this device). */
export function withApprovalLedger(
  approve: Services['approveReport'],
  ledger: PrivacyLedger,
): Services['approveReport'] {
  return (input) => {
    const result = approve(input);
    if (result.ok) {
      ledger.record({
        task: 'approve',
        source: 'local',
        dataClass: 'SANITIZED',
        demo: false,
        at: result.value.approvedAt,
      });
    }
    return result;
  };
}

/** The read-only part handed to features (a separate object, so `record` is not reachable). */
export function ledgerView(ledger: PrivacyLedger): PrivacyLedgerView {
  return { entries: () => ledger.entries(), subscribe: (listener) => ledger.subscribe(listener) };
}
