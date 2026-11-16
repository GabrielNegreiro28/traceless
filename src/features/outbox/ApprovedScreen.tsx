import { useId } from 'react';
import { Button } from '../../ui';
import { CheckedBadge } from '../review/CheckedBadge';
import type { ApprovedState, SubmittingState } from '../review/reportFlowTypes';
import { ReportText } from './ReportText';
import { StructuredReportCard } from './StructuredReportCard';
import type { ReportStructureView } from './useReportStructure';

export interface ApprovedScreenProps {
  /** `submitting` shows the same text while it is being sent. */
  readonly state: ApprovedState | SubmittingState;
  /** Discards the approval and returns to the outbox. */
  readonly onBack: () => void;
  /** Sends exactly this text to the organization. */
  readonly onSend: () => void;
  /** True when the demo scanner stood in for the AI (never labelled as AI). */
  readonly demo?: boolean;
  /** The structured card (structureReport); omitted, no card is shown. */
  readonly structure?: ReportStructureView;
}

function sendNote(sending: boolean, demo: boolean, withCategory: boolean): string {
  if (sending) return 'Sending only the approved text. Keep this tab open.';
  if (demo) return 'Demo mode: the report stays in this tab. You will get a case key to follow up.';
  const what = withCategory
    ? 'Only this text and its category are sent.'
    : 'Only this text is sent.';
  return `${what} You will get a case key to follow up, no account needed.`;
}

/**
 * The approved (sanitized) text, exactly as the organization will receive it, with a badge
 * saying how it was checked (derived from the scan, never hardcoded), and "Send to
 * organization". Sending needs a connection; it signs in anonymously only at that moment.
 */
export function ApprovedScreen({
  state,
  onBack,
  onSend,
  demo = false,
  structure,
}: ApprovedScreenProps) {
  const noteId = useId();
  const sending = state.status === 'submitting';
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
      {structure !== undefined && (
        <div className="mt-6 max-w-prose">
          <StructuredReportCard structure={structure} demo={demo} disabled={sending} />
        </div>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button variant="secondary" onClick={onBack} disabled={sending}>
          Back
        </Button>
        <Button onClick={onSend} loading={sending} aria-describedby={noteId}>
          {sending ? 'Sending…' : 'Send to organization'}
        </Button>
        <p id={noteId} className="text-muted" aria-live="polite">
          {sendNote(sending, demo, (structure?.category ?? null) !== null)}
        </p>
      </div>
    </section>
  );
}
