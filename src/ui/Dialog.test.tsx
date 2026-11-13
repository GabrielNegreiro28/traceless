import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { Dialog } from './Dialog';

beforeAll(() => {
  // jsdom has no modal dialog support; emulate just the open state.
  const proto = HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Cloud scan">
        <button onClick={() => setOpen(false)}>Done</button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('is hidden until opened and labelled by its title', async () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(screen.getByRole('dialog', { name: 'Cloud scan' })).toBeInTheDocument();
  });

  it('closes on Esc (the native cancel event) and returns focus to the trigger', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open it' });
    await userEvent.click(trigger);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes from inside and returns focus too', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open it' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
