import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppRoutes } from './router';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('route table', () => {
  it('always has the landing page and appends extra routes', () => {
    expect(createAppRoutes([]).map((r) => r.path)).toEqual(['/', '*']);
    expect(createAppRoutes([{ path: '/x' }]).map((r) => r.path)).toEqual(['/', '/x', '*']);
  });

  it('registers /eval in development', async () => {
    vi.stubEnv('DEV', true);
    vi.resetModules();
    const { devRoutes } = await import('./devRoutes');
    expect(devRoutes.map((r) => r.path)).toEqual(['/eval']);
  });

  it('has no /eval route when DEV is false', async () => {
    vi.stubEnv('DEV', false);
    vi.resetModules();
    const { devRoutes } = await import('./devRoutes');
    expect(devRoutes).toEqual([]);
  });
});

describe('navigation', () => {
  const landing = () =>
    screen.getByRole('heading', { level: 1, name: 'Report wrongdoing without leaving a trace.' });
  const open = (path: string) =>
    render(
      <RouterProvider
        router={createMemoryRouter(createAppRoutes([]), { initialEntries: [path] })}
      />,
    );

  it('renders the landing page at /', () => {
    open('/');
    expect(landing()).toBeInTheDocument();
  });

  it.each(['/nope', '/eval'])('redirects unknown path %s to the landing page', (path) => {
    open(path);
    expect(landing()).toBeInTheDocument();
  });
});
