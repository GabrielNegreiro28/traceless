import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Wordmark } from './Wordmark';

describe('Wordmark', () => {
  it('is announced once as "Traceless" and hides the decorative letters', () => {
    const { container } = render(<Wordmark />);
    expect(screen.getByText('Traceless')).toHaveClass('sr-only');
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('Traceless');
  });

  it('fades the last letters with decreasing opacity', () => {
    const { container } = render(<Wordmark />);
    const opacities = [...container.querySelectorAll<HTMLElement>('[aria-hidden] > span')].map(
      (el) => Number(el.style.opacity),
    );
    expect(opacities).toHaveLength(4);
    expect([...opacities].sort((a, b) => b - a)).toEqual(opacities);
  });
});
