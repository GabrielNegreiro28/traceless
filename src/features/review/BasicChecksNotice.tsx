/**
 * Shown on a review that only ran the pattern rules: the basic private check chosen when
 * on-device AI is unavailable, or "Continue with basic checks" after the on-device AI stalled
 * for good (docs/design/fase2-gate-iteration.md §G.2).
 */
export function BasicChecksNotice() {
  return (
    <div role="note" className="mt-4 max-w-prose rounded-md border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">Only basic checks ran</h2>
      <p className="mt-2">
        No AI checked this report. Only patterns such as email addresses, phone numbers, dates and
        sign-offs were checked. Details like your role, shift, location or team were not, so go
        through the Second look carefully before you continue.
      </p>
    </div>
  );
}
