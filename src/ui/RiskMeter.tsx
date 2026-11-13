import type { RiskLevel } from '../domain/risk/riskScorer';
import { cx } from './cx';
import { riskText } from './riskText';

const LEVELS: readonly RiskLevel[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];

const FILL_CLASSES: Readonly<Record<RiskLevel, string>> = {
  NONE: 'bg-accent',
  LOW: 'bg-accent',
  MEDIUM: 'bg-warning',
  HIGH: 'bg-danger',
};

export function RiskMeter(props: { readonly level: RiskLevel }) {
  const index = LEVELS.indexOf(props.level);
  const text = riskText(props.level);
  return (
    <div className="flex flex-col gap-2">
      <div
        role="meter"
        aria-label="Re-identification risk"
        aria-valuemin={0}
        aria-valuemax={LEVELS.length - 1}
        aria-valuenow={index}
        aria-valuetext={text}
        className="flex gap-1"
      >
        {LEVELS.slice(1).map((level, i) => (
          <span
            key={level}
            className={cx(
              'h-2 flex-1 rounded-full transition-colors',
              i < index ? FILL_CLASSES[props.level] : 'bg-border',
            )}
          />
        ))}
      </div>
      <p aria-live="polite" className="text-base font-semibold">
        {text}
      </p>
    </div>
  );
}
