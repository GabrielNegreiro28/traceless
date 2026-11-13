import { Button } from '../../ui';
import { detailsText } from './reviewModel';

/**
 * Back to edit and Continue. Continue is always enabled (approveReport is the real gate in
 * the outbox); it says what is still undecided. Sticky only on wide screens, where it cannot
 * hide the focused card.
 */
export function ReviewFooter(props: {
  readonly undecided: number;
  readonly onBackToEdit: () => void;
  readonly onContinue: () => void;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border bg-bg py-3 min-[769px]:sticky min-[769px]:bottom-0">
      <Button variant="secondary" onClick={props.onBackToEdit}>
        Back to edit
      </Button>
      <Button onClick={props.onContinue}>Continue</Button>
      {props.undecided > 0 && (
        <p className="text-muted">{detailsText(props.undecided)} still undecided</p>
      )}
    </div>
  );
}
