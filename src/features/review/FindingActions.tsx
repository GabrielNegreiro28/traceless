import { Button } from '../../ui';

export interface FindingActionHandlers {
  readonly onAccept: () => void;
  readonly onStartEdit: () => void;
  readonly onKeep: () => void;
  readonly onNotAboutMe: () => void;
}

/** The four ways to resolve a finding. There is deliberately no "accept all". */
export function FindingActions(props: FindingActionHandlers & { readonly quote: string }) {
  return (
    <div
      role="group"
      aria-label={`Decide about "${props.quote}"`}
      className="mt-3 flex flex-wrap gap-2"
    >
      <Button onClick={props.onAccept} aria-keyshortcuts="A">
        Accept
      </Button>
      <Button variant="secondary" onClick={props.onStartEdit} aria-keyshortcuts="E">
        Edit
      </Button>
      <Button variant="secondary" onClick={props.onKeep} aria-keyshortcuts="K">
        Keep anyway
      </Button>
      <Button variant="secondary" onClick={props.onNotAboutMe} aria-keyshortcuts="N">
        Not about me
      </Button>
    </div>
  );
}
