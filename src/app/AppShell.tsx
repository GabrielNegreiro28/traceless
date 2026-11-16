import { useEffect } from 'react';
import { Link, Outlet, useMatches } from 'react-router';
import { Wordmark } from '../ui/Wordmark';

export const DISCLAIMER =
  'Traceless reduces the risk of being identified; it cannot guarantee anonymity.';

/** Sets the document title from the deepest matched route's `handle.title`. */
function useRouteTitle(): void {
  const matches = useMatches();
  const handle = matches[matches.length - 1]?.handle as { title?: string } | undefined;
  const title = handle?.title;
  useEffect(() => {
    if (title !== undefined) document.title = title;
  }, [title]);
}

/** Page frame shared by every public route: skip link, header, main landmark and footer. */
export function AppShell() {
  useRouteTitle();
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to main content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center px-4 py-3 sm:px-6">
          <Link to="/" className="rounded-sm">
            <Wordmark />
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <p className="mx-auto w-full max-w-5xl px-4 py-4 text-sm text-muted sm:px-6">
          {DISCLAIMER}
        </p>
      </footer>
    </div>
  );
}
