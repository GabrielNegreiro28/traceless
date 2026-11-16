import { useId } from 'react';
import { Button } from '../../ui';
import { CheckedBadge } from '../review/CheckedBadge';
import type { ApprovedState } from '../review/reportFlowTypes';
import { ReportText } from './ReportText';

export interface ApprovedScreenProps {
  readonly state: ApprovedState;
  /** Discards the approval and returns to the outbox. */
  readonly onBack: () => void;
  /** True when the demo scanner stood in for the AI (never labelled as AI). */
  readonly demo?: boolean;
}

/**
 * The approved (sanitized) text, exactly as the organization would receive it, with a badge
 * saying how it was checked (derived from the scan, never hardcoded). Sending is the next
 * phase: the button is shown disabled with a note and never dispatches SUBMIT.
 */
export function ApprovedScreen({ state, onBack, demo = false }: ApprovedScreenProps) {
  const noteId = useId();
  return (
    <section>
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        Approved. This is what the organization will receive.
      </h1>
      <div className="mt-3">
        <CheckedBadge checks={state.checks} demo={demo} />
      </div>
      <div className="mt-6">
        <ReportText text={state.report.text} label="Approved text" />
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button disabled aria-describedby={noteId}>
          Send report
        </Button>
        <p id={noteId} className="text-muted">
          Sending arrives in the next version.
        </p>
      </div>
    </section>
  );
}
