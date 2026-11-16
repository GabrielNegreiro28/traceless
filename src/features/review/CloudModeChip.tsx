import { Cloud } from 'lucide-react';
import { Badge } from '../../ui';

export const CLOUD_MODE_LABEL = 'Cloud mode (with your consent)';

/** In demo mode the demo scanner stands in for the cloud AI and nothing leaves the device. */
export const DEMO_CLOUD_MODE_LABEL = 'Cloud mode demo (nothing leaves this device)';

/**
 * Persistent reminder, shown from the consented cloud scan through the review and outbox,
 * that this report was checked in the cloud because the reporter agreed to it.
 */
export function CloudModeChip({ demo = false }: { readonly demo?: boolean }) {
  return (
    <p className="mb-4">
      <Badge tone="cloud" icon={Cloud}>
        {demo ? DEMO_CLOUD_MODE_LABEL : CLOUD_MODE_LABEL}
      </Badge>
    </p>
  );
}
