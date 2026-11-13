import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/** A bordered surface for grouping related content. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('rounded-md border border-border bg-surface p-4', className)} />
  );
}
