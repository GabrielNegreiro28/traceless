import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ComposeScreen } from './ComposeScreen';
import { MAX_REPORT_CHARS } from './reportLimits';
import { SAMPLE_REPORT } from './sampleReport';

function Harness(props: { readonly onCheck?: () => void; readonly checking?: boolean }) {
  const [text, setText] = useState('');
  return (
    <ComposeScreen
      text={text}
      onTextChange={setText}
      onCheck={props.onCheck ?? (() => undefined)}
      checking={props.checking ?? false}
    />
  );
}

const field = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Your report' });
const checkButton = () => screen.getByRole('button', { name: 'Check my report' });

describe('ComposeScreen', () => {
  it('has an accessible label, the helper copy and the demo organization', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { level: 1, name: 'Write your report' })).toBeVisible();
    expect(field()).toHaveAccessibleDescription(/English only for now/);
    expect(screen.getByText('Demo organization: Halvern Freight (fictional)')).toBeVisible();
    expect(
      screen.getByText(
        'On supported Chrome, your text is checked on your device. Elsewhere, nothing is sent unless you explicitly agree.',
      ),
    ).toBeVisible();
  });

  it('shows a live character counter', async () => {
    render(<Harness />);
    expect(screen.getByText('0 / 6,000 characters')).toBeVisible();
    await userEvent.type(field(), 'Hello');
    expect(screen.getByText('5 / 6,000 characters')).toBeVisible();
  });

  it('caps the text at 6,000 characters and says so', () => {
    render(<Harness />);
    expect(field()).toHaveAttribute('maxlength', String(MAX_REPORT_CHARS));
    fireEvent.change(field(), { target: { value: 'a'.repeat(MAX_REPORT_CHARS + 50) } });
    expect(field().value).toHaveLength(MAX_REPORT_CHARS);
    expect(screen.getByText('6,000 / 6,000 characters')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('You reached the 6,000-character limit.');
  });

  it('fills the invented sample report', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Try a sample report' }));
    expect(field().value).toBe(SAMPLE_REPORT);
    expect(checkButton()).toBeEnabled();
  });

  it('hides "Try a sample report" while the unmodified sample is loaded, focusing the text', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Try a sample report' }));
    expect(screen.queryByRole('button', { name: 'Try a sample report' })).toBeNull();
    expect(field()).toHaveFocus();

    await userEvent.type(field(), '!');
    expect(screen.getByRole('button', { name: 'Try a sample report' })).toBeVisible();
  });

  it('hides "Try a sample report" when the page opens with the sample (/report?sample=1)', () => {
    render(
      <ComposeScreen
        text={SAMPLE_REPORT}
        onTextChange={() => undefined}
        onCheck={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Try a sample report' })).toBeNull();
  });

  it.each(['', '   \n\t '])('disables "Check my report" for %j', (text) => {
    render(<Harness />);
    if (text !== '') fireEvent.change(field(), { target: { value: text } });
    expect(checkButton()).toBeDisabled();
  });

  it('calls onCheck when the report has text', async () => {
    const onCheck = vi.fn();
    render(<Harness onCheck={onCheck} />);
    await userEvent.type(field(), 'Something happened.');
    await userEvent.click(checkButton());
    expect(onCheck).toHaveBeenCalledOnce();
  });

  it('keeps focus on the button and ignores clicks while checking', async () => {
    const onCheck = vi.fn();
    render(<Harness onCheck={onCheck} checking />);
    await userEvent.type(field(), 'Something happened.');
    const button = checkButton();
    button.focus();
    await userEvent.click(button);
    expect(onCheck).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
