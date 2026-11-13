import type { ReviewChoice } from '../../domain/rewrite/reviewDecision';
import { FindingList } from './FindingList';
import { HighlightedText } from './HighlightedText';
import { ProtectedMentions } from './ProtectedMentions';
import { detailsText, protectedQuotes } from './reviewModel';
import { ReviewFooter } from './ReviewFooter';
import { RiskPanel } from './RiskPanel';
import { SecondLook } from './SecondLook';
import type { ReviewingState } from './reportFlowTypes';
import { useReviewSession } from './useReviewSession';

export interface ReviewScreenProps {
  readonly state: ReviewingState;
  readonly onDecide: (findingId: string, choice: ReviewChoice) => void;
  readonly onUndo: (findingId: string) => void;
  readonly onBackToEdit: () => void;
  readonly onContinue: () => void;
}

const SHORTCUTS = 'When a card is focused: A accept, E edit, K keep, N not about me';

function EmptyState() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">We didn&apos;t spot identifying details.</h2>
        <p className="mt-2 text-muted">
          That does not mean there are none. Read your text once more with the questions below
          before you continue.
        </p>
      </div>
      <SecondLook defaultOpen />
    </div>
  );
}

function intro(count: number): string {
  if (count === 0) return 'Nothing has been sent. Your text is still only in this tab.';
  return `We found ${detailsText(count)} that could point to you. Decide what to do with each one. Nothing has been sent.`;
}

/**
 * The review: the report text with highlights on the left, the live risk and one card per
 * finding on the right (stacked on narrow screens). Decisions go through `onDecide`; the
 * reducer owns them. There is intentionally no "accept all".
 */
export function ReviewScreen(props: ReviewScreenProps) {
  const { state } = props;
  const session = useReviewSession({
    text: state.text,
    findings: state.findings,
    decisions: state.decisions,
    onDecide: props.onDecide,
    onUndo: props.onUndo,
  });
  const { snapshot } = session;
  const empty = state.findings.length === 0;
  return (
    <section>
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        Review your report
      </h1>
      <p className="mt-2 max-w-prose text-muted">{intro(state.findings.length)}</p>
      <p className="mt-1 text-sm text-muted">{SHORTCUTS}</p>
      <div role="status" aria-live="polite" className="sr-only">
        {session.message}
      </div>
      <div className="mt-6 grid gap-8 min-[769px]:grid-cols-2">
        <HighlightedText
          text={state.text}
          findings={state.findings}
          preview={snapshot.preview}
          states={snapshot.states}
          selectedId={session.selectedId}
          onActivate={session.focusCard}
        />
        <div className="flex flex-col gap-4">
          <div className="z-10 min-[769px]:sticky min-[769px]:top-2">
            <RiskPanel risk={state.risk} />
          </div>
          {empty ? (
            <EmptyState />
          ) : (
            <>
              <h2 className="text-lg font-semibold">Details to review</h2>
              <FindingList state={state} session={session} />
              <SecondLook />
            </>
          )}
          <ProtectedMentions quotes={protectedQuotes(state.text, state.protectedSpans)} />
        </div>
      </div>
      <ReviewFooter
        undecided={snapshot.pending.length}
        onBackToEdit={props.onBackToEdit}
        onContinue={props.onContinue}
      />
    </section>
  );
}
