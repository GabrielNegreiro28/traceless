import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ProgressCallback, Services } from '../../app/compositionRoot';
import { createFakeServices } from '../../app/services/renderWithServices';
import { ServicesProvider } from '../../app/services/ServicesProvider';
import type {
  DeviceAvailability,
  DeviceCapability,
} from '../../application/ports/DeviceCapability';
import type { ScanReportResult } from '../../application/usecases/scanReport';
import type { Finding, TextSpan } from '../../domain/detection/types';
import type { RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';

type ScanOutcome = Awaited<ReturnType<Services['scanReport']>>;

export interface PendingScan {
  readonly text: RawText;
  readonly onProgress: ProgressCallback | undefined;
  readonly succeed: (findings: readonly Finding[], protectedSpans?: readonly TextSpan[]) => void;
  readonly fail: (error: AppError) => void;
  readonly crash: () => void;
}

/** `findings` is the shipped field; the model-only fields stay empty so a mix-up is visible. */
function resultOf(
  findings: readonly Finding[],
  protectedSpans: readonly TextSpan[] = [],
): ScanReportResult {
  return {
    findings: [...findings],
    modelFindings: [],
    raw: { findings: [], modelFindings: [] },
    protectedSpans: [...protectedSpans],
    source: 'ON_DEVICE',
    stats: {
      chunks: 1,
      rawModelFindings: 0,
      locatedModelFindings: 0,
      unlocatedModelFindings: 0,
      suppressed: 0,
      retries: 0,
      verifyMs: 0,
      durationMs: 1,
    },
  };
}

/** A scanReport fake whose every call stays pending until the test settles it. */
export function controllableScan(): {
  readonly scanReport: Services['scanReport'];
  readonly calls: PendingScan[];
} {
  const calls: PendingScan[] = [];
  const scanReport: Services['scanReport'] = (text, onProgress) =>
    new Promise<ScanOutcome>((resolve, reject) => {
      calls.push({
        text,
        onProgress,
        succeed: (findings, spans) => resolve(ok(resultOf(findings, spans))),
        fail: (error) => resolve(err(error)),
        crash: () => reject(new Error('boom')),
      });
    });
  return { scanReport, calls };
}

export function servicesWrapper(overrides: Partial<Services>) {
  const services = createFakeServices(overrides);
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <ServicesProvider services={services}>{children}</ServicesProvider>;
  };
}

/** Runs the action inside an async act so effects and the promises it settles are flushed. */
export function settle(action: () => unknown): Promise<void> {
  return act(() =>
    Promise.resolve()
      .then(action)
      .then(() => undefined),
  );
}

export interface ControllableCapability extends DeviceCapability {
  /** Number of times prepare() was called. */
  readonly prepareCalls: () => number;
  /** Reports download progress through the callback the last prepare() received. */
  readonly progress: (fraction: number) => void;
  /** Settles the pending prepare(). */
  readonly finish: (outcome: Result<void, AppError>) => void;
}

/**
 * Minimal DeviceCapability (features tests may not import infrastructure fakes). check()
 * answers the given availability; prepare() stays pending until finish() is called.
 */
export function capabilityOf(availability: DeviceAvailability): ControllableCapability {
  let calls = 0;
  let report: (fraction: number) => void = () => undefined;
  let settleCall: (outcome: Result<void, AppError>) => void = () => undefined;
  return {
    check: () => Promise.resolve(availability),
    prepare: (onProgress) => {
      calls += 1;
      report = onProgress;
      return new Promise((resolve) => {
        settleCall = resolve;
      });
    },
    prepareCalls: () => calls,
    progress: (fraction) => report(fraction),
    finish: (outcome) => settleCall(outcome),
  };
}
