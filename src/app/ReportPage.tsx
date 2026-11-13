import { useEffect, useRef } from 'react';
import { ComposeScreen } from '../features/compose/ComposeScreen';
import { PrepareScreen } from '../features/onboarding/PrepareScreen';
import { ConsentPlaceholder } from '../features/review/ConsentPlaceholder';
import { FlowErrorPanel } from '../features/review/FlowErrorPanel';
import type { FlowState } from '../features/review/reportFlowMachine';
import { ReviewScreen } from '../features/review/ReviewScreen';
import { useReportFlow, type ReportFlow } from '../features/review/useReportFlow';
import { ScanningScreen } from '../features/scanning/ScanningScreen';
import { Button } from '../ui';

/** Moves focus to the new screen's heading whenever the flow changes screen. */
function useFocusHeadingOnTransition(status: FlowState['status']): void {
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current === status) return;
    previous.current = status;
    document.getElementById('screen-heading')?.focus();
  }, [status]);
}

/** Steps after review exist in the reducer but have no screen yet. */
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

function screenFor(flow: ReportFlow) {
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
      return <ScanningScreen progress={state.progress} onCancel={flow.cancelScan} />;
    case 'needsConsent':
      return <ConsentPlaceholder onBack={flow.backToEdit} />;
    case 'needsPrepare':
      return (
        <PrepareScreen
          progress={state.progress}
          onPrepare={flow.prepare}
          onBack={flow.backToEdit}
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
        />
      );
    case 'error':
      return <FlowErrorPanel error={state.error} onTryAgain={flow.backToEdit} />;
    case 'outbox':
    case 'approved':
    case 'submitting':
    case 'submitted':
      return <NotReady onReset={flow.reset} />;
  }
}

/** /report route: the reporter's flow, one screen per state of the reducer. */
export function ReportPage() {
  const flow = useReportFlow();
  useFocusHeadingOnTransition(flow.state.status);
  return screenFor(flow);
}
