import type { ReactNode } from 'react';

/** Text for assistive technology only; invisible on screen. */
export function VisuallyHidden(props: { readonly children: ReactNode }) {
  return <span className="sr-only">{props.children}</span>;
}
