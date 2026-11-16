import type { Clock } from '../application/ports/Clock';
import type { LedgerSource, PrivacyLedger } from '../application/ports/PrivacyLedger';
import type { ReportStructurer } from '../application/ports/ReportStructurer';
import { structureReport } from '../application/usecases/structureReport';
import { HybridReportStructurer } from '../infrastructure/ai/adapters/HybridReportStructurer';
import { structureReportModelSpec } from '../infrastructure/ai/adapters/structureReportModelSpec';
import { getAiService } from '../infrastructure/ai/aiService';
import { createHybridModel } from '../infrastructure/ai/hybridModel';
import type { AppEnv } from './env';
import { bootstrapFirebase } from './firebaseBootstrap';
import type { ScannerKind } from './ledgerDecorators';
import type { Services } from './servicesContract';

/**
 * Part of the composition root: structureReport, the hybrid showcase (design plan §1 item 5).
 * Firebase is only touched on first use, never while building the services.
 */

/** Upper bound for one structuring call, on the device or in the cloud. */
export const STRUCTURE_TIMEOUT_MS = 45_000;

/** The real structurer: the hybrid model (PREFER_ON_DEVICE) on the shared AI instance. */
export function createReportStructurer(env: AppEnv): ReportStructurer {
  return new HybridReportStructurer(
    () => createHybridModel(getAiService(bootstrapFirebase(env)), structureReportModelSpec()),
    STRUCTURE_TIMEOUT_MS,
  );
}

/**
 * Records one SANITIZED structureReport entry per success, with where it really ran (from the
 * SDK's inferenceSource), or `local` for the demo structurer. Failures record nothing.
 */
export function withStructureLedger(
  structure: Services['structureReport'],
  ledger: PrivacyLedger,
  clock: Clock,
  kind: ScannerKind,
): Services['structureReport'] {
  return async (text) => {
    const result = await structure(text);
    if (result.ok) {
      const demo = kind === 'demo';
      const real: LedgerSource = result.value.source === 'ON_DEVICE' ? 'onDevice' : 'cloud';
      const source = demo ? 'local' : real;
      ledger.record({
        task: 'structureReport',
        source,
        dataClass: 'SANITIZED',
        demo,
        at: clock.now(),
      });
    }
    return result;
  };
}

/** Binds the use case to its structurer and the ledger. */
export function bindStructureReport(
  structurer: ReportStructurer,
  ledger: PrivacyLedger,
  clock: Clock,
  kind: ScannerKind,
): Services['structureReport'] {
  return withStructureLedger((text) => structureReport(text, { structurer }), ledger, clock, kind);
}
