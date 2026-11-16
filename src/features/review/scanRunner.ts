import type { ProgressCallback, Services } from '../../app/compositionRoot';
import { createAppError } from '../../shared/appError';
import { logger } from '../../shared/logger';
import type { FlowEvent } from './reportFlowMachine';

/** Both scan services resolve to the same outcome type. */
export type ScanOutcome = Awaited<ReturnType<Services['scanReport']>>;

/** A scan service already bound to its text (and, for the cloud, its consent). */
export type BoundScan = (
  onProgress: ProgressCallback,
  isCancelled: () => boolean,
) => Promise<ScanOutcome>;

function outcomeEvent(scanId: string, outcome: ScanOutcome): FlowEvent {
  if (outcome.ok) {
    const { findings, protectedSpans } = outcome.value;
    return { type: 'SCAN_DONE', scanId, findings, protectedSpans };
  }
  return { type: 'SCAN_FAILED', scanId, error: outcome.error };
}

/** The scan use cases never throw, but a defect must not leave the screen scanning forever. */
function failureEvent(scanId: string): FlowEvent {
  logger.error('Scan threw', { kind: 'Unknown' });
  return {
    type: 'SCAN_FAILED',
    scanId,
    error: createAppError('Unknown', { message: 'The scan failed unexpectedly.' }),
  };
}

/**
 * Runs one scan for `scanId` and reports events only while `isActive()` holds. The same
 * predicate (inverted) is the scan's cancellation check, so a cancelled, superseded or
 * unmounted scan stops before its next chunk and never dispatches. The reducer also
 * ignores stale ids, so this is defense in depth. Shared by the on-device and cloud effects.
 */
export async function runScan(
  scan: BoundScan,
  scanId: string,
  dispatch: (event: FlowEvent) => void,
  isActive: () => boolean,
): Promise<void> {
  const onProgress: ProgressCallback = (done, total) => {
    if (isActive()) dispatch({ type: 'SCAN_PROGRESS', scanId, done, total });
  };
  let event: FlowEvent;
  try {
    event = outcomeEvent(scanId, await scan(onProgress, () => !isActive()));
  } catch {
    event = failureEvent(scanId);
  }
  if (!isActive()) return;
  if (event.type === 'SCAN_FAILED') logger.warn('Scan failed', { kind: event.error.kind });
  dispatch(event);
}
