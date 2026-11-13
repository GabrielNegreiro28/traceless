import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('keeps the text in the accessibility tree with the sr-only class', () => {
    render(<VisuallyHidden>Only for screen readers</VisuallyHidden>);
    expect(screen.getByText('Only for screen readers')).toHaveClass('sr-only');
  });
});
