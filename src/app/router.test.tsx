import { render, screen } from '@testing-library/react';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_REPORT } from '../features/compose/sampleReport';
import { createAppRoutes } from './router';
import { createFakeServices } from './services/renderWithServices';
import { ServicesProvider } from './services/ServicesProvider';

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
      <ServicesProvider services={createFakeServices()}>
        <RouterProvider
          router={createMemoryRouter(createAppRoutes([]), { initialEntries: [path] })}
        />
      </ServicesProvider>,
    );

  it('renders the landing page inside the shell at /', () => {
    open('/');
    expect(
      heading('Report wrongdoing without your own words giving you away.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it.each([
    ['/report', 'Write your report'],
    ['/case', 'Follow up on your case'],
  ])('renders %s inside the shell', (path, title) => {
    open(path);
    expect(heading(title)).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it.each([
    ['/', 'Traceless'],
    ['/report', 'Write your report | Traceless'],
    ['/case', 'Follow up on your case | Traceless'],
  ])('sets the document title for %s', (path, title) => {
    open(path);
    expect(document.title).toBe(title);
  });

  it('prefills the sample report from /report?sample=1', () => {
    open('/report?sample=1');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Your report').value).toBe(SAMPLE_REPORT);
  });

  it.each(['/nope', '/eval'])('redirects unknown path %s to the landing page', (path) => {
    open(path);
    expect(
      heading('Report wrongdoing without your own words giving you away.'),
    ).toBeInTheDocument();
  });
});
