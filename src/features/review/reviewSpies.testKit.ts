import { vi } from 'vitest';

/** Spies around a ReviewScreen that is driven by the real reducer, as in the app. */
export const spies = {
  onDecide: vi.fn(),
  onUndo: vi.fn(),
  onBackToEdit: vi.fn(),
  onContinue: vi.fn(),
};
