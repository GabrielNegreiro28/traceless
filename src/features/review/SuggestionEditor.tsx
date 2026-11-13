import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../../ui';

/** Inline editor for the replacement text. An empty replacement removes the detail. */
export function SuggestionEditor(props: {
  readonly initial: string;
  readonly quote: string;
  readonly onSave: (replacement: string) => void;
  readonly onCancel: () => void;
}) {
  const [value, setValue] = useState(props.initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      props.onSave(value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      props.onCancel();
    }
  };

  return (
    <div className="mt-3">
      <label htmlFor={inputId} className="block text-sm font-semibold">
        Your replacement for &ldquo;{props.quote}&rdquo;
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        aria-describedby={hintId}
        className="mt-1 block w-full rounded-md border border-border bg-bg p-2 text-base text-text"
      />
      <p id={hintId} className="mt-1 text-sm text-muted">
        Leave it empty to remove this detail.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button onClick={() => props.onSave(value)}>Save</Button>
        <Button variant="secondary" onClick={props.onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
