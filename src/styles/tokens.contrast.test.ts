/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Plain file read: vitest does not return CSS text for `?raw` css imports.
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

type Palette = Readonly<Record<string, string>>;

function parseVars(block: string): Palette {
  const entries = [...block.matchAll(/--tl-color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)];
  return Object.fromEntries(entries.map((m) => [m[1] ?? '', m[2] ?? '']));
}

const darkStart = css.indexOf('prefers-color-scheme: dark');
const LIGHT = parseVars(css.slice(0, darkStart));
const DARK: Palette = { ...LIGHT, ...parseVars(css.slice(darkStart)) };

function channel(hex: string, offset: number): number {
  const v = parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 2) + 0.0722 * channel(hex, 4);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** [foreground token, background token] for every text pair the UI kit uses. */
const TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['accent-contrast', 'accent'],
  ['danger', 'bg'],
  ['danger', 'surface'],
  ['warning', 'bg'],
  ['warning', 'surface'],
  ['cloud', 'bg'],
  ['cloud', 'surface'],
  ['text', 'accent-soft'],
  ['text', 'warning-soft'],
  ['text', 'danger-soft'],
  ['text', 'cloud-soft'],
  ['accent', 'accent-soft'],
  ['warning', 'warning-soft'],
  ['danger', 'danger-soft'],
  ['cloud', 'cloud-soft'],
  ['text-muted', 'accent-soft'],
  ['text-muted', 'warning-soft'],
  ['text-muted', 'danger-soft'],
  ['text-muted', 'cloud-soft'],
];

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
])('%s theme text contrast', (_name, palette) => {
  it.each(TEXT_PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    const fgHex = palette[fg];
    const bgHex = palette[bg];
    expect(fgHex, `missing token ${fg}`).toBeDefined();
    expect(bgHex, `missing token ${bg}`).toBeDefined();
    expect(contrast(fgHex ?? '', bgHex ?? '')).toBeGreaterThanOrEqual(4.5);
  });
});
