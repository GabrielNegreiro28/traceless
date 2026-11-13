import { clusterContaining } from '../../domain/rewrite/previewClusters';
import { FindingCard } from './FindingCard';
import { ACCEPT, editChoice, KEEP, NOT_ABOUT_ME } from './reviewChoices';
import { identicalCount } from './reviewModel';
import type { ReviewingState } from './reportFlowTypes';
import type { ReviewSession } from './useReviewSession';
import { useReviewShortcuts } from './useReviewShortcuts';

/**
 * One card per finding, in reading order. The card keys (A / E / K / N) are handled here, on
 * the list, and act only on the card that has focus.
 */
export function FindingList(props: {
  readonly state: ReviewingState;
  readonly session: ReviewSession;
}) {
  const { state, session } = props;
  const { decide, startEdit, cancelEdit, undo, select, snapshot } = session;
  const onKeyDown = useReviewShortcuts(session);
  return (
    <ol onKeyDown={onKeyDown} className="flex flex-col gap-3">
      {session.ordered.map((finding) => (
        <li key={finding.id}>
          <FindingCard
            finding={finding}
            decision={snapshot.decisionMap.get(finding.id)}
            state={snapshot.states.get(finding.id) ?? 'pending'}
            replacement={clusterContaining(snapshot.preview, finding)?.replacement}
            selected={session.selectedId === finding.id}
            editing={session.editingId === finding.id}
            identical={identicalCount(state.decisions, finding.id)}
            onSelect={() => select(finding.id)}
            onAccept={() => decide(finding.id, ACCEPT.choice, ACCEPT.label)}
            onStartEdit={() => startEdit(finding.id)}
            onSaveEdit={(text) => {
              const edit = editChoice(text);
              decide(finding.id, edit.choice, edit.label);
            }}
            onCancelEdit={() => cancelEdit(finding.id)}
            onKeep={() => decide(finding.id, KEEP.choice, KEEP.label)}
            onNotAboutMe={() => decide(finding.id, NOT_ABOUT_ME.choice, NOT_ABOUT_ME.label)}
            onUndo={() => undo(finding.id)}
          />
        </li>
      ))}
    </ol>
  );
}
