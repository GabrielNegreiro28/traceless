import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App, PRIVACY_PROMISE } from './App';

describe('App (landing content)', () => {
  it('shows the promise', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Report wrongdoing without leaving a trace.' }),
    ).toBeInTheDocument();
  });

  it('promises on-device checks only on supported Chrome, and consent elsewhere', () => {
    render(<App />);

    expect(screen.getByText(PRIVACY_PROMISE)).toBeVisible();
    expect(PRIVACY_PROMISE).toContain('nothing is sent unless you explicitly agree');
    expect(screen.queryByText(/right on your device/)).toBeNull();
  });
});
