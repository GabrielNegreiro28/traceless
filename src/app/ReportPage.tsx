import { useEffect, useRef } from 'react';
import { ComposeScreen } from '../features/compose/ComposeScreen';
import { CheckOptions } from '../features/onboarding/CheckOptions';
import { PrepareScreen } from '../features/onboarding/PrepareScreen';
import { ApprovalErrorPanel } from '../features/outbox/ApprovalErrorPanel';
import { ApprovedScreen } from '../features/outbox/ApprovedScreen';
import { OutboxScreen } from '../features/outbox/OutboxScreen';
import { PrivacyLedgerPanel } from '../features/privacy/PrivacyLedgerPanel';
import { CloudModeChip } from '../features/review/CloudModeChip';
import { FlowErrorPanel } from '../features/review/FlowErrorPanel';
import { copyToClipboard, reloadPage } from '../features/review/pageActions';
import type { ErrorState, FlowState } from '../features/review/reportFlowMachine';
import { isStall } from '../features/review/reportFlowStall';
import { ReviewScreen } from '../features/review/ReviewScreen';
import { isCloudMode } from '../features/review/scanSource';
import { StallPanel } from '../features/review/StallPanel';
import { useReportFlow, type ReportFlow } from '../features/review/useReportFlow';
import { ScanningScreen } from '../features/scanning/ScanningScreen';
import { Button } from '../ui';
import { useServices } from './services/useServices';

/** Moves focus to the new screen's heading whenever the flow changes screen. */
function useFocusHeadingOnTransition(status: FlowState['status']): void {
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current === status) return;
    previous.current = status;
    document.getElementById('screen-heading')?.focus();
  }, [status]);
}

/** Sending (Fase 4) exists in the reducer but has no screen yet. */
function NotReady({ onReset }: { readonly onReset: () => void }) {
  return (
    <section className="max-w-xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        This step isn&apos;t ready yet
      </h1>
      <div className="mt-6">
        <Button variant="secondary" onClick={onReset}>
          Start over
        </Button>
      </div>
    </section>
  );
}

/** An approval error, a stalled on-device scan (§G.2), or any other error. */
function errorScreenFor(flow: ReportFlow, state: ErrorState) {
  const afterCloud = 'checks' in state.previous && state.previous.checks === 'cloud';
  if (state.previous.status === 'outbox') {
    return (
      <ApprovalErrorPanel
        cloud={afterCloud}
        error={state.error}
        onBackToReview={flow.backToReview}
        onBackToOutbox={flow.backToEdit}
      />
    );
  }
  if (isStall(state)) {
    return (
      <StallPanel
        recoverable={state.error.recoverable}
        text={state.previous.text}
        onTryAgain={flow.retryScan}
        onBackToEdit={flow.backToEdit}
        onBasicChecks={flow.continueWithBasicChecks}
        copyText={copyToClipboard}
        reload={reloadPage}
      />
    );
  }
  // A failed consented cloud scan returns to the options screen.
  const cloud = state.previous.status === 'needsConsent';
  return (
    <FlowErrorPanel
      error={state.error}
      onTryAgain={flow.backToEdit}
      cloud={cloud}
      afterCloud={afterCloud}
    />
  );
}

/** `demo`: the demo scanner stands in for the AI, so no screen may call its results AI. */
function screenFor(flow: ReportFlow, demo: boolean) {
  const { state } = flow;
  switch (state.status) {
    case 'composing':
      return (
        <ComposeScreen
          text={state.text}
          onTextChange={flow.setText}
          onCheck={flow.startScan}
          checking={flow.checking}
        />
      );
    case 'scanning':
      return (
        <ScanningScreen
          progress={state.progress}
          onCancel={flow.cancelScan}
          mode={state.mode}
          demo={demo}
        />
      );
    case 'needsConsent':
      return (
        <CheckOptions
          text={state.text}
          onCloudScan={flow.startCloudScan}
          onBasicCheck={flow.runBasicCheck}
          onBack={flow.backToEdit}
          copyText={copyToClipboard}
        />
      );
    case 'needsPrepare':
      return (
        <PrepareScreen
          progress={state.progress}
          onPrepare={flow.prepare}
          onBack={flow.backToEdit}
          onShowOptions={flow.showOptions}
        />
      );
    case 'reviewing':
      return (
        <ReviewScreen
          state={state}
          onDecide={flow.decide}
          onUndo={flow.undoDecision}
          onBackToEdit={flow.backToEdit}
          onContinue={flow.openOutbox}
          demo={demo}
        />
      );
    case 'outbox':
      return (
        <OutboxScreen state={state} onApprove={flow.approve} onBackToReview={flow.backToEdit} />
      );
    case 'approved':
      return <ApprovedScreen state={state} onBack={flow.backToEdit} demo={demo} />;
    case 'error':
      return errorScreenFor(flow, state);
    case 'submitting':
    case 'submitted':
      return <NotReady onReset={flow.reset} />;
  }
}

/** Screens where the text has been touched, so the privacy ledger has something to say. */
const LEDGER_STATUSES: ReadonlySet<FlowState['status']> = new Set([
  'reviewing',
  'outbox',
  'approved',
]);

/** /report route: the reporter's flow, one screen per state of the reducer. */
export function ReportPage() {
  const flow = useReportFlow();
  const { demoAi } = useServices();
  useFocusHeadingOnTransition(flow.state.status);
  return (
    <>
      {isCloudMode(flow.state) && <CloudModeChip demo={demoAi} />}
      {screenFor(flow, demoAi)}
      {LEDGER_STATUSES.has(flow.state.status) && (
        <div className="mt-8">
          <PrivacyLedgerPanel />
        </div>
      )}
    </>
  );
}
