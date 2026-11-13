import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('is a type=button by default and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each(['primary', 'secondary', 'ghost'] as const)('renders the %s variant', (variant) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('loading marks the button busy and aria-disabled, ignores clicks and keeps focus', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps keyboard focus when it switches to loading', async () => {
    function Harness() {
      const [loading, setLoading] = useState(false);
      return (
        <Button loading={loading} onClick={() => setLoading(true)}>
          Check
        </Button>
      );
    }
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Check' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveFocus();
  });

  it('a loading submit button does not submit its form', async () => {
    const onSubmit = vi.fn();
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <Button type="submit" loading>
          Send
        </Button>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('respects the disabled prop', () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
