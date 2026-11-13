import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { App } from './App';
import { devRoutes } from './devRoutes';

/** The public route table plus any developer-only routes (empty in production). */
export function createAppRoutes(extraRoutes: readonly RouteObject[]): RouteObject[] {
  return [
    { path: '/', element: <App /> },
    ...extraRoutes,
    // Unknown paths (including /eval when it is not registered) go back to the landing page.
    { path: '*', element: <Navigate to="/" replace /> },
  ];
}

export function createAppRouter() {
  return createBrowserRouter(createAppRoutes(devRoutes));
}
