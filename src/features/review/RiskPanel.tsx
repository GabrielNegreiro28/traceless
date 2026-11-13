import type { RiskAssessment } from '../../domain/risk/riskScorer';
import { RiskMeter } from '../../ui';
import { driversSentence } from './reviewModel';

/** The live residual risk with a one-line reason; sticks to the top of the cards column. */
export function RiskPanel(props: { readonly risk: RiskAssessment }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <RiskMeter level={props.risk.level} announce={false} />
      <p className="mt-2 text-muted">{driversSentence(props.risk)}</p>
    </div>
  );
}
