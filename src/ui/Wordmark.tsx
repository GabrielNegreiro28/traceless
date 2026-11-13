import { VisuallyHidden } from './VisuallyHidden';

/** Opacity of each letter of the fading tail, purely decorative. */
const TAIL = [
  { letter: 'l', opacity: 0.8 },
  { letter: 'e', opacity: 0.62 },
  { letter: 's', opacity: 0.46 },
  { letter: 's', opacity: 0.32 },
] as const;

/** "Traceless" with the last letters fading out: the trace disappears. */
export function Wordmark() {
  return (
    <span className="text-xl font-bold tracking-tight text-text">
      <VisuallyHidden>Traceless</VisuallyHidden>
      <span aria-hidden="true">
        Trace
        {TAIL.map(({ letter, opacity }, i) => (
          <span key={i} style={{ opacity }}>
            {letter}
          </span>
        ))}
      </span>
    </span>
  );
}
