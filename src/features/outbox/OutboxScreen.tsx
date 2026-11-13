import { useId, useState } from 'react';
import { assessApproval } from '../../domain/review/approvalCheck';
import { Button, RiskMeter } from '../../ui';
import type { OutboxState } from '../review/reportFlowTypes';
import { ACKNOWLEDGEMENT_LABEL, residualRiskExplanation } from './outboxCopy';
import { ReportText } from './ReportText';

export interface OutboxScreenProps {
  readonly state: OutboxState;
  /** `acknowledged` is the checkbox; approveReport refuses a required one left unticked. */
  readonly onApprove: (acknowledged: boolean) => void;
  readonly onBackToReview: () => void;
}

function Acknowledgement(props: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex max-w-prose cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-4">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="mt-1 size-5 shrink-0 accent-accent"
      />
      <span>{ACKNOWLEDGEMENT_LABEL}</span>
    </label>
  );
}

/**
 * The outbox: the exact text that would leave the device, read-only, with the residual risk.
 * The checkbox appears when approveReport would require acknowledgement (the shared rule in
 * assessApproval), and Approve stays disabled until it is ticked.
 */
export function OutboxScreen({ state, onApprove, onBackToReview }: OutboxScreenProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const hintId = useId();
  const { risk, direct, acknowledgementRequired } = assessApproval(
    state.text,
    state.preview,
    state.findings,
    state.decisions,
  );
  const blocked = acknowledgementRequired && !acknowledged;
  return (
    <section>
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        Only this text will leave your device
      </h1>
      <p className="mt-2 max-w-prose text-muted">
        Read it once more. Nothing has been sent yet, and nothing is sent when you approve.
      </p>
      <div className="mt-6 grid gap-8 min-[769px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ReportText text={state.preview} label="Your text after your changes" />
        <div className="rounded-md border border-border bg-surface p-4">
          <RiskMeter level={risk.level} announce={false} />
          <p className="mt-2 text-muted">
            {residualRiskExplanation(risk.level, direct.keptAtRisk)}
          </p>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-4 border-t border-border pt-4">
        {acknowledgementRequired && (
          <Acknowledgement checked={acknowledged} onChange={setAcknowledged} />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={onBackToReview}>
            Back to review
          </Button>
          <Button
            disabled={blocked}
            aria-describedby={blocked ? hintId : undefined}
            onClick={() => onApprove(acknowledged)}
          >
            Approve this text
          </Button>
          {blocked && (
            <p id={hintId} className="text-muted">
              Tick the box above to approve.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
