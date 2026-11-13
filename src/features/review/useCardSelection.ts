import { useCallback, useEffect, useState } from 'react';

export interface CardSelection {
  readonly selectedId: string | null;
  /** Selects a card without moving focus. */
  readonly select: (findingId: string) => void;
  /** Selects a card and moves keyboard focus to it (so the card's keys work). */
  readonly focusCard: (findingId: string) => void;
}

/** Keeps the selected card in view; harmless where scrolling is not implemented. */
function useScrollToCard(selectedId: string | null): void {
  useEffect(() => {
    if (selectedId === null) return;
    const card = document.getElementById(`finding-${selectedId}`);
    if (typeof card?.scrollIntoView === 'function') card.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);
}

/** Moves DOM focus to the requested card; a new request object re-focuses the same card. */
function useFocusRequest(request: { readonly id: string } | null): void {
  useEffect(() => {
    if (request !== null) document.getElementById(`finding-${request.id}`)?.focus();
  }, [request]);
}

/** Which card is selected and where focus goes after an action, so keyboard users keep their place. */
export function useCardSelection(initial: string | null): CardSelection {
  const [selectedId, setSelectedId] = useState<string | null>(initial);
  const [request, setRequest] = useState<{ readonly id: string } | null>(null);
  useScrollToCard(selectedId);
  useFocusRequest(request);
  const focusCard = useCallback((findingId: string) => {
    setSelectedId(findingId);
    setRequest({ id: findingId });
  }, []);
  return { selectedId, select: setSelectedId, focusCard };
}
