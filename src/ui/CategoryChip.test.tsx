import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FINDING_CATEGORIES } from '../domain/detection/types';
import { CATEGORY_LABELS } from './categoryLabels';
import { CategoryChip } from './CategoryChip';

describe('CategoryChip', () => {
  it.each(FINDING_CATEGORIES)('shows a human-readable label for %s', (category) => {
    render(<CategoryChip category={category} />);
    const label = CATEGORY_LABELS[category];
    expect(label).not.toMatch(/_/);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('labels ROLE_UNIQUE as "Unique role" in the amber tone', () => {
    render(<CategoryChip category="ROLE_UNIQUE" />);
    expect(screen.getByText('Unique role')).toHaveClass('text-warning');
  });

  it('uses the danger color only for direct identifiers', () => {
    const dangerous = FINDING_CATEGORIES.filter((category) => {
      const { container, unmount } = render(<CategoryChip category={category} />);
      const isDanger = container.firstElementChild?.classList.contains('text-danger') === true;
      unmount();
      return isDanger;
    });
    expect(dangerous).toEqual(['DIRECT_IDENTIFIER']);
  });
});
