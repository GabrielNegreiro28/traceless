import { useEffect } from 'react';
import { useBlocker } from 'react-router';

/**
 * While `active` (a send is in flight), in-app navigation (the header link, browser back) is
 * refused, so the reporter cannot leave the page before learning the send's outcome and their
 * case key. Needs a data router (createBrowserRouter / createMemoryRouter).
 */
export function useNavigationLock(active: boolean): void {
  const blocker = useBlocker(active);
  useEffect(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);
}
