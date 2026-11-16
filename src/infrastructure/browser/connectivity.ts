/** The browser's connectivity hint. `navigator.onLine === false` reliably means offline. */
export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}
