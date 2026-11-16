import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StructuredReportCard } from './StructuredReportCard';
import type { ReportStructureView } from './useReportStructure';

const REPORT = {
  category: 'safety' as const,
  summary: 'Damaged batteries were shipped without fire-safety labels.',
  when: 'on the night of 14 March',
  where: null,
};

function view(overrides: Partial<ReportStructureView> = {}): ReportStructureView {
  return {
    status: 'ready',
    report: REPORT,
    source: 'ON_DEVICE',
    category: 'safety',
    setCategory: vi.fn(),
    ...overrides,
  };
}

const region = () => screen.getByRole('region', { name: 'What the organization will receive' });

describe('StructuredReportCard', () => {
  it('shows the organized fields with the on-device badge', () => {
    render(<StructuredReportCard structure={view()} demo={false} />);
    expect(region()).toBeVisible();
    expect(screen.getByText('Organized on your device')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('safety');
    expect(screen.getByText(REPORT.summary)).toBeVisible();
    expect(screen.getByText('on the night of 14 March')).toBeVisible();
    expect(screen.getByText('Not stated')).toBeVisible();
  });

  it('says when the cloud organized it, and that only approved text went there', () => {
    render(<StructuredReportCard structure={view({ source: 'IN_CLOUD' })} demo={false} />);
    expect(screen.getByText('Organized in the cloud — only your approved text')).toBeVisible();
  });

  it('never labels the demo structurer as AI', () => {
    render(<StructuredReportCard structure={view()} demo />);
    expect(screen.getByText('Organized by the demo organizer (no AI)')).toBeVisible();
    expect(screen.queryByText('Organized on your device')).toBeNull();
  });

  it('lets the reporter change the category', async () => {
    const structure = view();
    render(<StructuredReportCard structure={structure} demo={false} />);
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Category' }),
      'retaliation',
    );
    expect(structure.setCategory).toHaveBeenCalledWith('retaliation');
  });

  it('locks the category while sending', () => {
    render(<StructuredReportCard structure={view()} demo={false} disabled />);
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeDisabled();
  });

  it('shows a loading state', () => {
    const loading = view({ status: 'loading', report: null, source: null, category: null });
    render(<StructuredReportCard structure={loading} demo={false} />);
    expect(screen.getByText('Organizing your approved text…')).toBeVisible();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('fails gracefully: the report can still be sent', () => {
    const failed = view({ status: 'failed', report: null, source: null, category: null });
    render(<StructuredReportCard structure={failed} demo={false} />);
    expect(screen.getByText('Couldn’t organize the report — you can still send it.')).toBeVisible();
  });
});
