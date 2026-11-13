import { useCallback, type KeyboardEvent } from 'react';
import { ACCEPT, KEEP, NOT_ABOUT_ME } from './reviewChoices';
import type { ReviewSession } from './useReviewSession';

/** True when typing is going on, so letters must reach the field, not the shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** The id of the finding whose card contains the event target, if any. */
export function cardIdOf(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  return target.closest<HTMLElement>('[data-finding-id]')?.dataset.findingId ?? null;
}

/**
 * A / E / K / N act on the card that has keyboard focus (WCAG 2.1.4: the keys only work
 * while a card is focused, and they act on that card). Put the returned handler on the
 * list of cards. Ignored while typing, with a modifier held, on a held-down key (repeat),
 * while editing, and on a card that is not undecided.
 */
export function useReviewShortcuts(
  session: ReviewSession,
): (event: KeyboardEvent<HTMLElement>) => void {
  const { editingId, snapshot, decide, startEdit } = session;
  return useCallback(
    (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.defaultPrevented || editingId !== null || isTypingTarget(event.target)) return;
      const id = cardIdOf(event.target);
      if (id === null || snapshot.states.get(id) !== 'pending') return;
      const key = event.key.toLowerCase();
      if (key === 'a') decide(id, ACCEPT.choice, ACCEPT.label);
      else if (key === 'k') decide(id, KEEP.choice, KEEP.label);
      else if (key === 'n') decide(id, NOT_ABOUT_ME.choice, NOT_ABOUT_ME.label);
      else if (key === 'e') startEdit(id);
      else return;
      event.preventDefault();
    },
    [editingId, snapshot, decide, startEdit],
  );
}
