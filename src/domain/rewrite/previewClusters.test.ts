import { describe, expect, it } from 'vitest';
import { toRawText } from '../text/brandedText';
import { remainingFindings } from '../review/reviewState';
import { clusterContaining, previewClusters } from './previewClusters';
import { accept, edit, findingOf, keep } from './rewriteTestKit';
import { applyDecisions } from './rewriteApplier';

const text = 'I am the night shift lead at Dock B.';
const lead = findingOf(text, 'the night shift lead', { suggestion: 'a staff member' });
const shift = findingOf(text, 'night shift', { suggestion: 'a shift' });
const leadAt = findingOf(text, 'lead at Dock B', { suggestion: 'in the warehouse' });
const dock = findingOf(text, 'Dock B', { suggestion: '[place]' });

describe('previewClusters', () => {
  it('is empty when nothing changes the text', () => {
    const preview = previewClusters(text, [lead, shift], [keep(lead)]);
    expect(preview.clusters).toEqual([]);
    expect(preview.covered.size).toBe(0);
  });

  it('gives a single change its span, replacement and members', () => {
    const preview = previewClusters(text, [lead, dock], [accept(dock)]);
    expect(preview.clusters).toEqual([
      { span: dock.span, replacement: '[place]', primaryId: dock.id, memberIds: [dock.id] },
    ]);
    expect(preview.covered.size).toBe(0);
  });

  it('marks a pending finding inside an accepted one as covered by it', () => {
    const preview = previewClusters(text, [lead, shift], [accept(lead)]);
    expect(preview.clusters).toHaveLength(1);
    expect(preview.clusters[0]).toMatchObject({ span: lead.span, replacement: 'a staff member' });
    expect([...preview.covered]).toEqual([[shift.id, lead.id]]);
  });

  it('covers a finding with its own non-text decision too (kept or not about me)', () => {
    const preview = previewClusters(text, [lead, shift], [accept(lead), keep(shift)]);
    expect(preview.covered.has(shift.id)).toBe(true);
  });

  it('lets a typed inner edit win over the outer accepted finding (as the applier does)', () => {
    const decisions = [accept(lead), edit(shift, 'a crew')];
    const preview = previewClusters(text, [lead, shift], decisions);
    expect(preview.clusters).toEqual([
      {
        span: lead.span,
        replacement: 'a crew',
        primaryId: shift.id,
        memberIds: [lead.id, shift.id],
      },
    ]);
    expect(preview.covered.size).toBe(0);
    const applied = applyDecisions(toRawText(text), [lead, shift], decisions);
    expect(applied.ok && applied.value).toBe('I am a crew at Dock B.');
  });

  it('merges partial overlaps into the union with the earliest finding replacement', () => {
    const preview = previewClusters(text, [lead, leadAt], [accept(leadAt), accept(lead)]);
    expect(preview.clusters).toHaveLength(1);
    expect(preview.clusters[0]?.span).toEqual({ start: lead.span.start, end: leadAt.span.end });
    expect(preview.clusters[0]?.replacement).toBe('a staff member');
    expect(preview.clusters[0]?.memberIds).toEqual(expect.arrayContaining([lead.id, leadAt.id]));
  });

  it('does not cover a partly overlapping pending finding (the risk still counts it)', () => {
    const preview = previewClusters(text, [lead, leadAt], [accept(lead)]);
    expect(preview.covered.has(leadAt.id)).toBe(false);
  });

  it('agrees with remainingFindings: covered findings are exactly the ones that disappear', () => {
    const findings = [lead, shift, leadAt, dock];
    const decisions = [accept(lead)];
    const preview = previewClusters(text, findings, decisions);
    const remaining = new Set(remainingFindings(findings, decisions).map((f) => f.id));
    for (const finding of findings) {
      const decidedHere = decisions.some((d) => d.findingId === finding.id);
      expect(remaining.has(finding.id)).toBe(!decidedHere && !preview.covered.has(finding.id));
    }
  });

  it('returns an empty preview for an invalid plan instead of throwing', () => {
    expect(previewClusters(text, [lead], [accept(shift)]).clusters).toEqual([]);
  });

  it('clusterContaining finds the change over a finding', () => {
    const preview = previewClusters(text, [lead, shift], [accept(lead)]);
    expect(clusterContaining(preview, shift)?.primaryId).toBe(lead.id);
    expect(clusterContaining(preview, dock)).toBeUndefined();
  });
});
