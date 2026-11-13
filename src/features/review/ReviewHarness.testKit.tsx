import { useReducer } from 'react';
import { reportFlowReducer, type ReviewingState } from './reportFlowMachine';
import { ReviewScreen } from './ReviewScreen';
import { spies } from './reviewSpies.testKit';

/** A ReviewScreen wired to the real reducer (test only). */
export function ReviewHarness(props: { readonly initial: ReviewingState }) {
  const [state, dispatch] = useReducer(reportFlowReducer, props.initial);
  if (state.status !== 'reviewing') return <p>left review</p>;
  return (
    <ReviewScreen
      state={state}
      onDecide={(findingId, choice) => {
        spies.onDecide(findingId, choice);
        dispatch({ type: 'DECIDE', findingId, choice });
      }}
      onUndo={(findingId) => {
        spies.onUndo(findingId);
        dispatch({ type: 'UNDO_DECISION', findingId });
      }}
      onBackToEdit={spies.onBackToEdit}
      onContinue={spies.onContinue}
    />
  );
}
