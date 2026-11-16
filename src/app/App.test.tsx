import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App, LOGLINE, PRIVACY_PROMISE } from './App';

const renderApp = () =>
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );

describe('App (landing content)', () => {
  it('shows the logline, the thesis and the three steps', () => {
    renderApp();

    expect(screen.getByRole('heading', { level: 1, name: LOGLINE })).toBeInTheDocument();
    expect(screen.getByText('Anonymity fails by content, not by channel.')).toBeVisible();
    const steps = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(steps).toEqual(['Write', 'Check on your device', 'Send only approved text']);
  });

  it('links a prominent sample path to the report flow', () => {
    renderApp();

    expect(screen.getByRole('link', { name: 'Try a sample report' })).toHaveAttribute(
      'href',
      '/report?sample=1',
    );
    expect(screen.getByRole('link', { name: 'Write your own report' })).toHaveAttribute(
      'href',
      '/report',
    );
  });

  it('promises on-device checks only on supported Chrome, and consent elsewhere', () => {
    renderApp();

    expect(PRIVACY_PROMISE).toContain('nothing is sent unless you explicitly agree');
    expect(
      screen.getByText(/Elsewhere, nothing is sent unless you explicitly agree/),
    ).toBeVisible();
    expect(screen.queryByText(/right on your device/)).toBeNull();
  });
});
