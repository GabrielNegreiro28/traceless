import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CheckedBadge } from './CheckedBadge';
import { CLOUD_MODE_LABEL, CloudModeChip, DEMO_CLOUD_MODE_LABEL } from './CloudModeChip';

describe('CloudModeChip', () => {
  it('reminds the reporter that the cloud check ran with their consent', () => {
    render(<CloudModeChip />);
    expect(screen.getByText(CLOUD_MODE_LABEL)).toBeVisible();
  });

  it('says nothing leaves the device in demo mode', () => {
    render(<CloudModeChip demo />);
    expect(screen.getByText(DEMO_CLOUD_MODE_LABEL)).toBeVisible();
    expect(screen.queryByText(CLOUD_MODE_LABEL)).not.toBeInTheDocument();
  });
});

describe('CheckedBadge', () => {
  it.each([
    ['full', false, 'Checked on your device'],
    ['cloud', false, 'Checked in the cloud, with your consent'],
    ['basic', false, 'Basic private check (patterns only)'],
    ['cloud', true, 'Checked by the demo scanner (no AI)'],
  ] as const)('shows %s checks (demo: %s) as "%s"', (checks, demo, label) => {
    render(<CheckedBadge checks={checks} demo={demo} />);
    expect(screen.getByText(label)).toBeVisible();
  });
});
