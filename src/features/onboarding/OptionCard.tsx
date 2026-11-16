import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../../ui/cx';

export type OptionTone = 'cloud' | 'neutral' | 'accent';

const ICON_TONES: Readonly<Record<OptionTone, string>> = {
  cloud: 'text-cloud',
  neutral: 'text-text',
  accent: 'text-accent',
};

/** One way to check the report: an icon (never color alone), a title and its content. */
export function OptionCard(props: {
  readonly icon: LucideIcon;
  readonly tone: OptionTone;
  readonly title: string;
  readonly children: ReactNode;
}) {
  const Icon = props.icon;
  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon
          aria-hidden="true"
          strokeWidth={1.5}
          className={cx('size-5 shrink-0', ICON_TONES[props.tone])}
        />
        {props.title}
      </h2>
      <div className="mt-2">{props.children}</div>
    </section>
  );
}
