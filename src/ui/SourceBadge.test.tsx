import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SourceBadge, type SourceVariant } from './SourceBadge';

const CASES: readonly (readonly [SourceVariant, string, string])[] = [
  ['onDevice', 'On your device', 'text-accent'],
  ['cloud', 'Cloud', 'text-cloud'],
  ['rules', 'Pattern rule', 'text-text'],
];

describe('SourceBadge', () => {
  it.each(CASES)('%s shows the visible label %s with its own tone', (variant, label, toneClass) => {
    const { container } = render(<SourceBadge variant={variant} />);
    expect(screen.getByText(label)).toHaveClass(toneClass);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows a custom label when given', () => {
    render(<SourceBadge variant="onDevice" label="On-device AI" />);
    expect(screen.getByText('On-device AI')).toHaveClass('text-accent');
  });
});
