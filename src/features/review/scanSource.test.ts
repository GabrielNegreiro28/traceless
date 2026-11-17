import { describe, expect, it } from 'vitest';
import { checkedBadge, isCloudMode, modelFindingBadge } from './scanSource';
import { approved, outbox, reviewing, scanning, TEXT } from './reportFlowTestKit';
import type { FlowState } from './reportFlowTypes';

describe('checkedBadge', () => {
  it.each([
    ['full', false, 'onDevice', 'Checked on your device'],
    ['cloud', false, 'cloud', 'Checked in the cloud, with your consent'],
    ['basic', false, 'rules', 'Basic private check (patterns only)'],
    ['full', true, 'rules', 'Checked by the demo scanner (no AI)'],
    ['cloud', true, 'rules', 'Checked by the demo scanner (no AI)'],
    ['basic', true, 'rules', 'Basic private check (patterns only)'],
  ] as const)('%s checks (demo: %s) read as %s', (checks, demo, variant, label) => {
    expect(checkedBadge(checks, demo)).toEqual({ variant, label });
  });
});

describe('modelFindingBadge', () => {
  it.each([
    ['full', false, 'onDevice', 'On-device AI'],
    ['cloud', false, 'cloud', 'Cloud AI'],
    ['full', true, 'rules', 'Demo scanner'],
    ['cloud', true, 'rules', 'Demo scanner'],
    ['basic', false, 'rules', 'Pattern rule'],
  ] as const)('%s checks (demo: %s) read as %s', (checks, demo, variant, label) => {
    expect(modelFindingBadge(checks, demo)).toEqual({ variant, label });
  });
});

describe('isCloudMode', () => {
  const cloud = { checks: 'cloud' } as const;
  it.each<[string, FlowState, boolean]>([
    ['a consented cloud scan', { ...scanning, mode: 'consentedCloud' }, true],
    ['an on-device scan', scanning, false],
    ['a cloud review', { ...reviewing, ...cloud }, true],
    ['a cloud outbox', { ...outbox, ...cloud }, true],
    ['a cloud approval', { ...approved(), ...cloud }, true],
    ['an on-device review', reviewing, false],
    ['a basic review', { ...reviewing, checks: 'basic' }, false],
    ['the options screen', { status: 'needsConsent', text: TEXT }, false],
    ['the composer', { status: 'composing', text: TEXT }, false],
  ])('is %s → %s', (_label, state, expected) => {
    expect(isCloudMode(state)).toBe(expected);
  });
});
