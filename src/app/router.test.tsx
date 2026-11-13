import { render, screen } from '@testing-library/react';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppRoutes } from './router';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const topLevel = (routes: readonly RouteObject[]) => routes.map((r) => r.path);
const shellChildren = (routes: readonly RouteObject[]) =>
  (routes[0]?.children ?? []).map((r) => (r.index === true ? '(index)' : r.path));

describe('route table', () => {
  it('has the shell with landing, report and case, then a catch-all', () => {
    const routes = createAppRoutes([]);
    expect(topLevel(routes)).toEqual(['/', '*']);
    expect(shellChildren(routes)).toEqual(['(index)', 'report', 'case']);
  });

  it('appends extra routes between the shell and the catch-all', () => {
    expect(topLevel(createAppRoutes([{ path: '/x' }]))).toEqual(['/', '/x', '*']);
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
  const heading = (name: string) => screen.getByRole('heading', { level: 1, name });
  const open = (path: string) =>
    render(
      <RouterProvider
        router={createMemoryRouter(createAppRoutes([]), { initialEntries: [path] })}
      />,
    );

  it('renders the landing page inside the shell at /', () => {
    open('/');
    expect(heading('Report wrongdoing without leaving a trace.')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it.each([
    ['/report', 'Compose your report'],
    ['/case', 'Follow up on your case'],
  ])('renders the %s placeholder inside the shell', (path, title) => {
    open(path);
    expect(heading(title)).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it.each(['/nope', '/eval'])('redirects unknown path %s to the landing page', (path) => {
    open(path);
    expect(heading('Report wrongdoing without leaving a trace.')).toBeInTheDocument();
  });
});
