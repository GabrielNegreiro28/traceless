import type { AuthService } from '../application/ports/AuthService';
import type { Clock } from '../application/ports/Clock';
import type { PrivacyLedger } from '../application/ports/PrivacyLedger';
import type { ReportRepository } from '../application/ports/ReportRepository';
import { lookUpCase } from '../application/usecases/lookUpCase';
import { submitReport } from '../application/usecases/submitReport';
import { isBrowserOnline } from '../infrastructure/browser/connectivity';
import { FakeAuthService } from '../infrastructure/fakes/FakeAuthService';
import { FakeReportRepository } from '../infrastructure/fakes/FakeReportRepository';
import { createAnonymousAuthService } from '../infrastructure/firebase/anonymousAuth';
import { getAuthService } from '../infrastructure/firebase/auth';
import { getDb } from '../infrastructure/firebase/firestore';
import { createFirestoreReportRepository } from '../infrastructure/firebase/firestoreReportRepository';
import { generateCaseKey } from '../domain/case/caseKey';
import { cryptoRandomBytes } from '../infrastructure/random/cryptoRandomBytes';
import type { AppEnv } from './env';
import { bootstrapFirebase } from './firebaseBootstrap';
import type { ScannerKind } from './ledgerDecorators';
import type { Services } from './servicesContract';

/**
 * Part of the composition root: sending the approved report and the read-only follow-up
 * (Fase 4). Firebase is only touched when the reporter sends or looks up a case.
 */

/** The demo organization that receives every report (PLANO §3.5). */
export const DEMO_ORG_ID = 'acme-demo';

/** Upper bound for one Firestore call before the reporter sees "Reconnect to send". */
export const FIRESTORE_TIMEOUT_MS = 20_000;

export interface CaseBackend {
  readonly auth: AuthService;
  readonly repository: ReportRepository;
}

export function createRealCaseBackend(env: AppEnv): CaseBackend {
  const options = { useEmulators: env.useEmulators };
  return {
    auth: createAnonymousAuthService(() => getAuthService(bootstrapFirebase(env), options)),
    repository: createFirestoreReportRepository(() => getDb(bootstrapFirebase(env), options), {
      orgId: DEMO_ORG_ID,
      timeoutMs: FIRESTORE_TIMEOUT_MS,
    }),
  };
}

/** Demo mode: the "organization" is an in-memory map; nothing leaves the tab. */
export function createFakeCaseBackend(): CaseBackend {
  return { auth: new FakeAuthService(), repository: new FakeReportRepository() };
}

/**
 * Records one SANITIZED submit entry per successful send: `cloud` (Firestore), or `local` for
 * the demo backend, which sends nothing. A failed send records nothing.
 */
export function withSubmitLedger(
  submit: Services['submitReport'],
  ledger: PrivacyLedger,
  clock: Clock,
  kind: ScannerKind,
): Services['submitReport'] {
  return async (text, caseKey, details) => {
    const result = await submit(text, caseKey, details);
    if (result.ok) {
      const demo = kind === 'demo';
      const source = demo ? 'local' : 'cloud';
      ledger.record({ task: 'submit', source, dataClass: 'SANITIZED', demo, at: clock.now() });
    }
    return result;
  };
}

export type CaseServices = Pick<Services, 'issueCaseKey' | 'submitReport' | 'lookUpCase'>;

/** Binds the submit and follow-up use cases to the backend, the CSPRNG and the ledger. */
export function bindCaseServices(
  backend: CaseBackend,
  ledger: PrivacyLedger,
  clock: Clock,
  kind: ScannerKind,
): CaseServices {
  const deps = { ...backend, isOnline: isBrowserOnline };
  const submit: Services['submitReport'] = (text, caseKey, details) =>
    submitReport(text, caseKey, deps, details);
  return {
    issueCaseKey: () => generateCaseKey(cryptoRandomBytes),
    submitReport: withSubmitLedger(submit, ledger, clock, kind),
    lookUpCase: (input) => lookUpCase(input, deps),
  };
}
