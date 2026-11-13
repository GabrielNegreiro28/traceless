import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders children and merges extra class names and attributes', () => {
    render(
      <Card className="extra" data-testid="card">
        Hello
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveTextContent('Hello');
    expect(card).toHaveClass('extra', 'bg-surface');
  });
});
