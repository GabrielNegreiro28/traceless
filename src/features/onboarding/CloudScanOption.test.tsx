import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CLOUD_CHECKING_NOTE,
  CLOUD_DISABLED_NOTE,
  OWN_TEXT_ACK_LABEL,
  SAMPLE_CLOUD_NOTE,
} from './checkOptionsCopy';
import { CloudScanOption } from './CloudScanOption';
import type { CloudAvailability } from './useCloudScanAvailability';

function renderOption(availability: CloudAvailability, sample: boolean) {
  const onScan = vi.fn();
  const view = render(
    <CloudScanOption availability={availability} sample={sample} onScan={onScan} />,
  );
  return { onScan, unmount: view.unmount };
}

const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));

describe('CloudScanOption', () => {
  it('checks the unmodified sample in one click, without the dialog', async () => {
    const { onScan } = renderOption('enabled', true);
    expect(screen.getByText(SAMPLE_CLOUD_NOTE)).toBeVisible();
    await click('Check the sample in the cloud');
    expect(onScan).toHaveBeenCalledExactlyOnceWith({ kind: 'sample' });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it("asks for consent in a dialog before checking the reporter's own text", async () => {
    const { onScan } = renderOption('enabled', false);
    await click('Check my text in the cloud');
    expect(onScan).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('checkbox', { name: OWN_TEXT_ACK_LABEL }));
    await click('Check in the cloud');
    expect(onScan).toHaveBeenCalledExactlyOnceWith({ kind: 'own-text', acknowledged: true });
  });

  it('sends nothing when the reporter cancels the dialog', async () => {
    const { onScan } = renderOption('enabled', false);
    await click('Check my text in the cloud');
    await click('Cancel');
    expect(onScan).not.toHaveBeenCalled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it.each([
    ['checking', CLOUD_CHECKING_NOTE],
    ['disabled', CLOUD_DISABLED_NOTE],
  ] as const)('offers nothing while %s', (availability, note) => {
    for (const sample of [true, false]) {
      const { unmount } = renderOption(availability, sample);
      expect(screen.getByText(note)).toBeVisible();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      unmount();
    }
  });
});
