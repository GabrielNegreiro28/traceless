import { describe, expect, it } from 'vitest';
import type { Finding } from '../detection/types';
import { toRawText } from '../text/brandedText';
import { accept, edit, findingOf, keep, notAboutMe } from './rewriteTestKit';
import { applyDecisions, type ReviewDecision } from './rewriteApplier';

function apply(
  text: string,
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
): string {
  const result = applyDecisions(toRawText(text), findings, decisions);
  if (!result.ok) throw new Error(`unexpected error: ${result.error.message}`);
  return result.value;
}

describe('applyDecisions: single decisions', () => {
  const text = 'I am the only night nurse in Ward 7.';
  const role = findingOf(text, 'the only night nurse', { suggestion: 'a nurse' });
  const ward = findingOf(text, 'Ward 7', { suggestion: 'the hospital' });

  it('ACCEPTED uses the suggestion', () => {
    expect(apply(text, [role], [accept(role)])).toBe('I am a nurse in Ward 7.');
  });

  it('EDITED uses the replacement', () => {
    expect(apply(text, [ward], [edit(ward, 'a ward')])).toBe(
      'I am the only night nurse in a ward.',
    );
  });

  it.each([
    ['KEPT_RISK', keep],
    ['NOT_ABOUT_ME', notAboutMe],
  ])('%s leaves the text unchanged', (_name, decide) => {
    expect(apply(text, [role, ward], [decide(role), decide(ward)])).toBe(text);
  });

  it('applies several non-overlapping decisions regardless of their order', () => {
    const forward = apply(text, [role, ward], [accept(role), accept(ward)]);
    const backward = apply(text, [ward, role], [accept(ward), accept(role)]);
    expect(forward).toBe('I am a nurse in the hospital.');
    expect(backward).toBe(forward);
  });
});

describe('applyDecisions: identity', () => {
  const text = 'Shift at 6am, Dock B, since 2019.';
  const findings = [findingOf(text, '6am'), findingOf(text, 'Dock B'), findingOf(text, '2019')];

  it('returns the same text with no decisions', () => {
    expect(apply(text, findings, [])).toBe(text);
  });

  it('is idempotent when every finding is kept', () => {
    const once = apply(text, findings, findings.map(keep));
    expect(once).toBe(text);
    expect(apply(once, findings, findings.map(keep))).toBe(text);
  });

  it('returns an empty text unchanged', () => {
    expect(apply('', [], [])).toBe('');
  });
});

describe('applyDecisions: removal', () => {
  it('removes the span when the suggestion is null and joins the words', () => {
    const text = 'Call me at 555-0142 today.';
    const phone = findingOf(text, '555-0142', { suggestion: null });
    expect(apply(text, [phone], [accept(phone)])).toBe('Call me at today.');
  });

  it('removes the span for a blank EDITED replacement', () => {
    const text = 'I work nights, badge 4471, in receiving.';
    const badge = findingOf(text, 'badge 4471');
    expect(apply(text, [badge], [edit(badge, '  ')])).toBe('I work nights, in receiving.');
  });

  it('cleans up removals at the start and end of the text', () => {
    const text = 'jo@acme.com wrote this. Reach me at jo@acme.com';
    const first = findingOf(text, 'jo@acme.com', { suggestion: null });
    const last = findingOf(text, 'jo@acme.com', { suggestion: null }, 1);
    expect(apply(text, [first, last], [accept(first), accept(last)])).toBe(
      'wrote this. Reach me at',
    );
  });

  it('removes two neighbouring details with a single clean join', () => {
    const text = 'Seen on March 3 at Dock B, by me.';
    const date = findingOf(text, 'on March 3', { suggestion: null });
    const dock = findingOf(text, 'at Dock B', { suggestion: null });
    expect(apply(text, [date, dock], [accept(date), accept(dock)])).toBe('Seen, by me.');
  });

  it('drops brackets that a removal leaves empty', () => {
    const text = 'Ask the lead (ext. 4471) for the log.';
    const ext = findingOf(text, 'ext. 4471', { suggestion: null });
    expect(apply(text, [ext], [accept(ext)])).toBe('Ask the lead for the log.');
  });

  it('keeps paragraph breaks around a removed line ending', () => {
    const text = 'Night shift.\nCall 555-0142\nThanks.';
    const phone = findingOf(text, '555-0142', { suggestion: null });
    expect(apply(text, [phone], [accept(phone)])).toBe('Night shift.\nCall\nThanks.');
  });
});

describe('applyDecisions: unicode', () => {
  it('handles accents and astral characters (UTF-16 offsets)', () => {
    const text = 'Je suis 👩‍⚕️ la seule infirmière de nuit à Zürich.';
    const city = findingOf(text, 'Zürich', { suggestion: 'la ville' });
    const role = findingOf(text, 'la seule infirmière de nuit', { suggestion: 'infirmière' });
    expect(apply(text, [city, role], [accept(city), accept(role)])).toBe(
      'Je suis 👩‍⚕️ infirmière à la ville.',
    );
  });
});

describe('applyDecisions: errors (no partial output)', () => {
  const text = 'Dock B at 6am.';
  const dock = findingOf(text, 'Dock B');

  it('rejects an unknown finding id', () => {
    const result = applyDecisions(
      toRawText(text),
      [dock],
      [{ findingId: 'nope', action: 'ACCEPTED' }],
    );
    expect(result).toMatchObject({ ok: false, error: { kind: 'Unknown' } });
  });

  it('rejects two decisions for one finding', () => {
    const result = applyDecisions(toRawText(text), [dock], [accept(dock), keep(dock)]);
    expect(result.ok).toBe(false);
  });

  it('rejects EDITED without a replacement', () => {
    const result = applyDecisions(
      toRawText(text),
      [dock],
      [{ findingId: dock.id, action: 'EDITED' }],
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a stale finding whose quote no longer matches the text', () => {
    const result = applyDecisions(toRawText('Pier 9 at 6am.'), [dock], [accept(dock)]);
    expect(result.ok).toBe(false);
  });

  it('never puts report text in the error message', () => {
    const result = applyDecisions(toRawText('Pier 9 at 6am.'), [dock], [accept(dock)]);
    expect(result.ok ? '' : result.error.message).not.toMatch(/Pier|Dock/);
  });
});
