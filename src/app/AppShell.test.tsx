import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { AppShell, DISCLAIMER } from './AppShell';

function renderShell() {
  const router = createMemoryRouter(
    [{ element: <AppShell />, children: [{ path: '/', element: <h1>Page body</h1> }] }],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('AppShell', () => {
  it('has a skip link that targets the main landmark', () => {
    renderShell();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('renders the wordmark home link, the routed page and the honest footer', () => {
    renderShell();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Traceless' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('heading', { name: 'Page body' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(DISCLAIMER);
    expect(DISCLAIMER).toMatch(/cannot guarantee anonymity/);
  });
});
