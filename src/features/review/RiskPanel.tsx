import type { RiskAssessment } from '../../domain/risk/riskScorer';
import { RiskMeter } from '../../ui';
import { cx } from '../../ui/cx';
import {
  BASIC_RISK_MAY_BE_HIGHER,
  BASIC_RISK_NOT_RATED,
  BASIC_RISK_NOT_RATED_TITLE,
} from './basicChecksCopy';
import { driversSentence } from './reviewModel';

export interface RiskPanelProps {
  readonly risk: RiskAssessment;
  /** Only the pattern rules ran: "nothing found" must not read as "no risk". */
  readonly basic?: boolean;
  /** Text shown under the meter; defaults to the live drivers sentence. */
  readonly explanation?: string;
  readonly className?: string;
}

/**
 * The live residual risk with a one-line reason. After a basic check with nothing left, the
 * level is not rated at all (no meter), and with findings left it warns that the real risk
 * may be higher.
 */
export function RiskPanel(props: RiskPanelProps) {
  const { risk, basic = false } = props;
  const frame = cx('rounded-md border border-border bg-surface p-4', props.className);
  if (basic && risk.level === 'NONE') {
    return (
      <div className={frame}>
        <p className="text-lg font-semibold">{BASIC_RISK_NOT_RATED_TITLE}</p>
        <p className="mt-2 text-muted">{BASIC_RISK_NOT_RATED}</p>
      </div>
    );
  }
  return (
    <div className={frame}>
      <RiskMeter level={risk.level} announce={false} />
      <p className="mt-2 text-muted">{props.explanation ?? driversSentence(risk)}</p>
      {basic && <p className="mt-2 text-muted">{BASIC_RISK_MAY_BE_HIGHER}</p>}
    </div>
  );
}
