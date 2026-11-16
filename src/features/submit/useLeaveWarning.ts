import { useEffect } from 'react';

/**
 * While `active`, asks the browser to confirm before the tab closes or reloads (the report or
 * the case key lives only in this tab's memory).
 */
export function useLeaveWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}
