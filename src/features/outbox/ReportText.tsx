import { useId } from 'react';

/**
 * The text that will leave (or left) review, read-only, at reading measure: line-height 1.6
 * and at most 68 characters wide. A blank text says so instead of showing an empty box.
 */
export function ReportText(props: { readonly text: string; readonly label: string }) {
  const blank = props.text.trim() === '';
  const captionId = useId();
  return (
    <figure aria-labelledby={captionId} className="rounded-md border border-border bg-surface p-4">
      <figcaption id={captionId} className="text-sm font-semibold text-muted">
        {props.label}
      </figcaption>
      {blank ? (
        <p className="mt-3 text-muted">There is no text left.</p>
      ) : (
        <p className="mt-3 max-w-[68ch] whitespace-pre-wrap break-words text-lg leading-[1.6]">
          {props.text}
        </p>
      )}
    </figure>
  );
}
