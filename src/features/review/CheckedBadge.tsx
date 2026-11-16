import { SourceBadge } from '../../ui';
import type { ScanChecks } from './reportFlowTypes';
import { checkedBadge } from './scanSource';

/** How the report was checked: on the device (lock), in the cloud (cloud) or basic (ruler). */
export function CheckedBadge(props: { readonly checks: ScanChecks; readonly demo: boolean }) {
  const { variant, label } = checkedBadge(props.checks, props.demo);
  return <SourceBadge variant={variant} label={label} />;
}
