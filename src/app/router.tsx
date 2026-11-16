import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { CaseLookupPage } from '../features/followup/CaseLookupPage';
import { App } from './App';
import { AppShell } from './AppShell';
import { devRoutes } from './devRoutes';
import { ReportPage } from './ReportPage';

/** Public screens, rendered inside the shared AppShell. */
const shellRoutes: RouteObject[] = [
  { index: true, element: <App />, handle: { title: 'Traceless' } },
  { path: 'report', element: <ReportPage />, handle: { title: 'Write your report | Traceless' } },
  {
    path: 'case',
    element: <CaseLookupPage />,
    handle: { title: 'Follow up on your case | Traceless' },
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
