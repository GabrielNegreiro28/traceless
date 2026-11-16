import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '../../app/services/useServices';
import type { CaseRecord } from '../../application/ports/ReportRepository';
import type { DeadlineSettings } from '../../domain/case/caseTimeline';
import { createAppError, type AppError } from '../../shared/appError';
import { logger } from '../../shared/logger';

export type CaseLookupState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | {
      readonly status: 'found';
      readonly record: CaseRecord;
      readonly deadlines: DeadlineSettings;
      /** When the case was read (wall time), so overdue steps are computed once. */
      readonly readAt: number;
    }
  | { readonly status: 'failed'; readonly error: AppError };

const CRASHED = createAppError('Unknown', { message: 'Looking up the case failed.' });

/**
 * The read-only follow-up (Fase 4): looks up one case by the key the reporter typed, with the
 * deadlines from Remote Config (`ack_deadline_days`, `feedback_deadline_days`, in-code
 * defaults otherwise). The key lives only in the page's memory.
 */
export function useCaseLookup(now: () => number = Date.now): {
  readonly state: CaseLookupState;
  readonly lookUp: (input: string) => void;
} {
  const { lookUpCase, config } = useServices();
  const [state, setState] = useState<CaseLookupState>({ status: 'idle' });
  const request = useRef(0);

  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );

  const lookUp = useCallback(
    (input: string) => {
      request.current += 1;
      const id = request.current;
      setState({ status: 'loading' });
      void Promise.all([lookUpCase(input), config.load()])
        .then(([result, appConfig]): CaseLookupState => {
          if (!result.ok) return { status: 'failed', error: result.error };
          const deadlines = {
            ackDays: appConfig.ackDeadlineDays,
            feedbackDays: appConfig.feedbackDeadlineDays,
          };
          return { status: 'found', record: result.value, deadlines, readAt: now() };
        })
        .catch((): CaseLookupState => ({ status: 'failed', error: CRASHED }))
        .then((next) => {
          if (request.current !== id) return;
          if (next.status === 'failed')
            logger.info('Case lookup failed', { kind: next.error.kind });
          setState(next);
        });
    },
    [config, lookUpCase, now],
  );

  return { state, lookUp };
}
