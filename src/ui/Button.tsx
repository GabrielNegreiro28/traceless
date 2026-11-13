import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  /** Shows a spinner, sets aria-busy and blocks clicks. */
  readonly loading?: boolean;
}

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary: 'bg-accent text-accent-contrast border-transparent hover:opacity-90',
  secondary: 'bg-surface text-text border-border hover:bg-bg',
  ghost: 'bg-transparent text-text border-transparent hover:bg-surface',
};

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 py-2 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cx(BASE, VARIANT_CLASSES[variant], className)}
    >
      {loading && (
        <Loader2 aria-hidden="true" strokeWidth={1.5} className="size-5 motion-safe:animate-spin" />
      )}
      {children}
    </button>
  );
}
