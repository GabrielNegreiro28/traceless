import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { findingOf } from '../../domain/rewrite/rewriteTestKit';
import { FindingCard, type FindingCardProps } from './FindingCard';
import type { FindingState } from './reviewModel';

const TEXT = 'I am the night lead at Dock B.';
const DOCK = findingOf(TEXT, 'Dock B');

function renderCard(state: FindingState, identical: number) {
  const props: FindingCardProps = {
    finding: DOCK,
    decision: { findingId: DOCK.id, action: 'ACCEPTED' },
    state,
    replacement: '[place]',
    selected: false,
    editing: false,
    identical,
    onSelect: vi.fn(),
    onAccept: vi.fn(),
    onStartEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onKeep: vi.fn(),
    onNotAboutMe: vi.fn(),
    onUndo: vi.fn(),
  };
  return render(<FindingCard {...props} />);
}

describe('FindingCard: identical mentions line', () => {
  it('says how many identical mentions received the decision', () => {
    renderCard('accepted', 2);
    expect(screen.getByText('Also applied to 2 identical mentions.')).toBeVisible();
  });

  it('is hidden when the card is covered by a wider change', () => {
    renderCard('covered', 2);
    expect(screen.queryByText(/Also applied to/)).toBeNull();
  });
});
