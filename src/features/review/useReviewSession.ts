import { useCallback, useMemo, useState } from 'react';
import type { Finding } from '../../domain/detection/types';
import { propagateDecision, undoDecision } from '../../domain/review/decisionPropagation';
import { remainingRisk } from '../../domain/review/reviewState';
import type { ReviewChoice, ReviewDecision } from '../../domain/rewrite/reviewDecision';
import { announcement, inReadingOrder } from './reviewModel';
import { nextPendingId, snapshotOf, type ReviewSnapshot } from './reviewSnapshot';
import { useCardSelection } from './useCardSelection';

export interface ReviewSessionInput {
  readonly text: string;
  readonly findings: readonly Finding[];
  readonly decisions: readonly ReviewDecision[];
  readonly onDecide: (findingId: string, choice: ReviewChoice) => void;
  readonly onUndo: (findingId: string) => void;
}

export interface ReviewSession {
  readonly ordered: readonly Finding[];
  readonly snapshot: ReviewSnapshot;
  readonly selectedId: string | null;
  readonly editingId: string | null;
  /** The polite live-region text describing the last change. */
  readonly message: string;
  readonly select: (findingId: string) => void;
  /** A mark was activated: select its card and move focus there. */
  readonly focusCard: (findingId: string) => void;
  readonly decide: (findingId: string, choice: ReviewChoice, label: string) => void;
  readonly startEdit: (findingId: string) => void;
  readonly cancelEdit: (findingId: string) => void;
  readonly undo: (findingId: string) => void;
}

/** What the screen will show after a change, and the sentence that announces it. */
function afterChange(
  text: string,
  ordered: readonly Finding[],
  decisions: readonly ReviewDecision[],
  label: string,
): { readonly snapshot: ReviewSnapshot; readonly message: string } {
  const snapshot = snapshotOf(text, ordered, decisions);
  const risk = remainingRisk(ordered, decisions);
  return { snapshot, message: announcement(label, risk, snapshot.pending.length) };
}

/**
 * Selection, inline editing, auto-advance and the live-region message of the review screen.
 * The reducer owns the decisions; this derives the follow-up (next card, announcement) from
 * the same pure domain functions the reducer uses, so no effect has to copy state.
 */
export function useReviewSession(input: ReviewSessionInput): ReviewSession {
  const { text, findings, decisions, onDecide, onUndo } = input;
  const ordered = useMemo(() => inReadingOrder(findings), [findings]);
  const snapshot = useMemo(() => snapshotOf(text, ordered, decisions), [text, ordered, decisions]);
  const cards = useCardSelection(nextPendingId(ordered, snapshot.pending, null));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const { focusCard, select } = cards;

  const decide = useCallback(
    (findingId: string, choice: ReviewChoice, label: string) => {
      if (snapshot.states.get(findingId) !== 'pending') return;
      const next = propagateDecision(findings, decisions, findingId, choice);
      const change = afterChange(text, ordered, next, label);
      onDecide(findingId, choice);
      setMessage(change.message);
      setEditingId(null);
      focusCard(nextPendingId(ordered, change.snapshot.pending, findingId) ?? findingId);
    },
    [snapshot, findings, decisions, ordered, onDecide, focusCard, text],
  );

  const undo = useCallback(
    (findingId: string) => {
      const next = undoDecision(decisions, findingId);
      setMessage(afterChange(text, ordered, next, 'Undone').message);
      onUndo(findingId);
      focusCard(findingId);
    },
    [decisions, ordered, onUndo, focusCard, text],
  );

  const startEdit = useCallback(
    (findingId: string) => {
      select(findingId);
      setEditingId(findingId);
    },
    [select],
  );

  const cancelEdit = useCallback(
    (findingId: string) => {
      setEditingId(null);
      focusCard(findingId);
    },
    [focusCard],
  );

  return { ordered, snapshot, editingId, message, ...cards, decide, startEdit, cancelEdit, undo };
}
