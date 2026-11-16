import { useId, useState } from 'react';
import { assessApproval } from '../../domain/review/approvalCheck';
import { Button } from '../../ui';
import { BASIC_CONFIRMATION_LABEL } from '../review/basicChecksCopy';
import { RiskPanel } from '../review/RiskPanel';
import type { OutboxState } from '../review/reportFlowTypes';
import { ACKNOWLEDGEMENT_LABEL, residualRiskExplanation } from './outboxCopy';
import { ReportText } from './ReportText';

export interface OutboxScreenProps {
  readonly state: OutboxState;
  /** `acknowledged` is the checkbox; approveReport refuses a required one left unticked. */
  readonly onApprove: (acknowledged: boolean) => void;
  readonly onBackToReview: () => void;
}

/** The input is named by its label both ways (wrapped and `htmlFor`), for every AT and test. */
function Acknowledgement(props: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  const inputId = useId();
  return (
    <label
      htmlFor={inputId}
      className="flex max-w-prose cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-4"
    >
      <input
        id={inputId}
        type="checkbox"
        name="acknowledge-remaining-risk"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="mt-1 size-5 shrink-0 accent-accent"
      />
      <span>{props.label}</span>
    </label>
  );
}

/** In cloud mode the original already left this device for the check (with consent). */
function headings(cloud: boolean): { readonly title: string; readonly lead: string } {
  return cloud
    ? {
        title: 'Only this text will be sent to the organization',
        lead: 'Read it once more. Nothing has been sent to the organization yet, and nothing is sent when you approve.',
      }
    : {
        title: 'Only this text will leave your device',
        lead: 'Read it once more. Nothing has been sent yet, and nothing is sent when you approve.',
      };
}

/**
 * The outbox: the exact text that would leave the device, read-only, with the residual risk.
 * The checkbox appears when approveReport would require acknowledgement (the shared rule in
 * assessApproval), and always after a basic check (only the pattern rules ran, so the reporter
 * confirms that indirect details were not checked); Approve stays disabled until it is ticked.
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
  const basic = state.checks === 'basic';
  const needsCheckbox = basic || acknowledgementRequired;
  const blocked = needsCheckbox && !acknowledged;
  const { title, lead } = headings(state.checks === 'cloud');
  return (
    <section>
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        {title}
      </h1>
      <p className="mt-2 max-w-prose text-muted">{lead}</p>
      <div className="mt-6 grid gap-8 min-[769px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ReportText text={state.preview} label="Your text after your changes" />
        <RiskPanel
          risk={risk}
          basic={basic}
          explanation={residualRiskExplanation(risk.level, direct.keptAtRisk)}
          className="self-start"
        />
      </div>
      <div className="mt-8 flex flex-col gap-4 border-t border-border pt-4">
        {needsCheckbox && (
          <Acknowledgement
            label={basic ? BASIC_CONFIRMATION_LABEL : ACKNOWLEDGEMENT_LABEL}
            checked={acknowledged}
            onChange={setAcknowledged}
          />
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
