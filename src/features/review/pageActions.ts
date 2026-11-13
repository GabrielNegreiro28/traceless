/**
 * Browser actions behind "Copy my text and reload" (docs/design/fase2-gate-iteration.md §G.2).
 * The report text lives only in this tab's memory, so a reload (the only way to restart a
 * stuck on-device model) would lose it: the reporter copies it first, by their own click.
 */

/** Copies the reporter's own text to the clipboard; false when the browser refuses. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Reloads the page (clears the draft); only ever called from an explicit confirmation. */
export function reloadPage(): void {
  window.location.reload();
}
