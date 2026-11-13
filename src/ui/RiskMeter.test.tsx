import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RiskLevel } from '../domain/risk/riskScorer';
import { RiskMeter } from './RiskMeter';

const CASES: readonly (readonly [RiskLevel, number, string])[] = [
  ['NONE', 0, 'Risk: none'],
  ['LOW', 1, 'Risk: low'],
  ['MEDIUM', 2, 'Risk: medium'],
  ['HIGH', 3, 'Risk: high'],
];

describe('RiskMeter', () => {
  it.each(CASES)('%s exposes meter semantics and a text value', (level, now, text) => {
    render(<RiskMeter level={level} />);
    const meter = screen.getByRole('meter', { name: 'Re-identification risk' });
    expect(meter).toHaveAttribute('aria-valuenow', String(now));
    expect(meter).toHaveAttribute('aria-valuemax', '3');
    expect(meter).toHaveAttribute('aria-valuetext', text);
    expect(screen.getByText(text)).toBeVisible();
  });

  it('announces changes politely and updates in place', () => {
    const { rerender } = render(<RiskMeter level="HIGH" />);
    const live = screen.getByText('Risk: high');
    expect(live).toHaveAttribute('aria-live', 'polite');
    rerender(<RiskMeter level="LOW" />);
    expect(live).toHaveTextContent('Risk: low');
  });

  it('can silence its live region so the screen announces risk once', () => {
    render(<RiskMeter level="HIGH" announce={false} />);
    expect(screen.getByText('Risk: high')).not.toHaveAttribute('aria-live');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', 'Risk: high');
  });
});
