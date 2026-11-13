import { FINDING_CATEGORIES } from '../../domain/detection/types';
import { CATEGORY_LABELS } from '../../ui';
import { SECOND_LOOK_PROMPTS } from './secondLookPrompts';

/**
 * A collapsible checklist of every category, for the details the scan can miss. The reporter
 * is the final check, so the copy says plainly that Traceless can be wrong.
 */
export function SecondLook(props: { readonly defaultOpen?: boolean }) {
  return (
    <details
      open={props.defaultOpen === true}
      className="rounded-md border border-border bg-surface p-4"
    >
      <summary className="cursor-pointer text-base font-semibold">Second look</summary>
      <p className="mt-3 text-muted">
        Traceless can miss or misjudge details; you are the final check. Read your text once more
        with these questions in mind.
      </p>
      <ul className="mt-3 space-y-2">
        {FINDING_CATEGORIES.map((category) => (
          <li key={category}>
            <span className="font-semibold">{CATEGORY_LABELS[category]}: </span>
            {SECOND_LOOK_PROMPTS[category]}
          </li>
        ))}
      </ul>
    </details>
  );
}
