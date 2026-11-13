import { useEffect, useId, useRef, type ReactNode } from 'react';

export interface DialogProps {
  readonly open: boolean;
  /** Called on Esc; the parent owns the `open` state. */
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
}

function show(dialog: HTMLDialogElement): void {
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function hide(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

/** Native modal <dialog>: the browser traps focus; we return it to the trigger on close. */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null || !open) return undefined;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    show(dialog);
    return () => {
      hide(dialog);
      trigger?.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-md border border-border bg-surface p-6 text-text backdrop:bg-black/50"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </dialog>
  );
}
