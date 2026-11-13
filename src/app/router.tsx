import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { App } from './App';
import { AppShell } from './AppShell';
import { devRoutes } from './devRoutes';
import { PlaceholderPage } from './PlaceholderPage';

/** Public screens, rendered inside the shared AppShell. */
const shellRoutes: RouteObject[] = [
  { index: true, element: <App /> },
  {
    path: 'report',
    element: (
      <PlaceholderPage
        title="Compose your report"
        description="Writing and checking your report will be available here soon."
      />
    ),
  },
  {
    path: 'case',
    element: (
      <PlaceholderPage
        title="Follow up on your case"
        description="Enter your case key here to see updates once this screen is ready."
      />
    ),
  },
];

/** The public route table plus any developer-only routes (empty in production). */
export function createAppRoutes(extraRoutes: readonly RouteObject[]): RouteObject[] {
  return [
    { path: '/', element: <AppShell />, children: shellRoutes },
    ...extraRoutes,
    // Unknown paths (including /eval when it is not registered) go back to the landing page.
    { path: '*', element: <Navigate to="/" replace /> },
  ];
}

export function createAppRouter() {
  return createBrowserRouter(createAppRoutes(devRoutes));
}
