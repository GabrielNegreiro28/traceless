import { render, screen } from '@testing-library/react';
import { Lock } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('shows its text label and hides the decorative icon from assistive tech', () => {
    const { container } = render(
      <Badge tone="accent" icon={Lock}>
        Label
      </Badge>,
    );
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders without an icon', () => {
    const { container } = render(<Badge tone="danger">Alert</Badge>);
    expect(container.querySelector('svg')).toBeNull();
  });
});
