import { Badge } from '../../ui';

/**
 * Display-only list of people the scan decided are not the reporter. Collapsed by default;
 * nothing here can be decided, so a wrong call is fixed by editing the text.
 */
export function ProtectedMentions(props: { readonly quotes: readonly string[] }) {
  if (props.quotes.length === 0) return null;
  return (
    <details className="rounded-md border border-border bg-surface p-4">
      <summary className="cursor-pointer text-base font-semibold">
        Kept as written (looks like other people, not you)
      </summary>
      <p className="mt-3 text-muted">
        If one of these is actually about you, use Back to edit to change it.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {props.quotes.map((quote) => (
          <li key={quote}>
            <Badge tone="neutral">{quote}</Badge>
          </li>
        ))}
      </ul>
    </details>
  );
}
