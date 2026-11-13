import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

export type BadgeTone = 'accent' | 'cloud' | 'neutral' | 'warning' | 'danger';

const TONE_CLASSES: Readonly<Record<BadgeTone, string>> = {
  accent: 'bg-accent-soft text-accent',
  cloud: 'bg-cloud-soft text-cloud',
  neutral: 'bg-surface text-text',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

/** A small pill with an optional icon. The label is always visible text, never color alone. */
export function Badge(props: {
  readonly tone: BadgeTone;
  readonly icon?: LucideIcon;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}) {
  const Icon = props.icon;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border border-current/30 px-2.5 py-0.5 text-sm font-medium',
        TONE_CLASSES[props.tone],
        props.className,
      )}
    >
      {Icon && <Icon aria-hidden="true" strokeWidth={1.5} className="size-4" />}
      {props.children}
    </span>
  );
}
