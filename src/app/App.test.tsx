import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the product name and promise', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Report wrongdoing without leaving a trace.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Traceless')).toBeInTheDocument();
  });
});
