import { describe, expect, it } from 'vitest';
import { buildRatchetedBaseline } from '../../scripts/update-duplication-baseline.mjs';

const baseline = {
  schemaVersion: 1,
  minimumAnalyzedSources: 425,
  detector: {
    name: 'jscpd',
    version: '5.0.12',
    mode: 'mild',
    minLines: 5,
    minTokens: 50,
    maxSize: '10mb',
  },
  scope: { paths: ['src'], formats: ['typescript', 'javascript'], ignore: [] },
  limits: { clones: 68, duplicatedLines: 687, percentage: 2.2 },
  knownCloneFingerprints: ['old-a', 'old-b'],
};

describe('buildRatchetedBaseline', () => {
  it('replaces fingerprints and lowers ceilings to the fresh totals', () => {
    const next = buildRatchetedBaseline(baseline, {
      fingerprints: ['b-new', 'a-new'],
      totals: { clones: 10, duplicatedLines: 100, percentage: 0.5 },
    });
    expect(next.knownCloneFingerprints).toEqual(['a-new', 'b-new']);
    expect(next.limits).toEqual({ clones: 10, duplicatedLines: 100, percentage: 2.2 });
    expect(next.minimumAnalyzedSources).toBe(425);
  });

  it('refuses to ratchet up', () => {
    expect(() =>
      buildRatchetedBaseline(baseline, {
        fingerprints: ['x'],
        totals: { clones: 69, duplicatedLines: 100, percentage: 0.5 },
      }),
    ).toThrow(/ratchet/i);
    expect(() =>
      buildRatchetedBaseline(baseline, {
        fingerprints: ['x'],
        totals: { clones: 10, duplicatedLines: 688, percentage: 0.5 },
      }),
    ).toThrow(/ratchet/i);
  });

  it('rejects duplicate fingerprints', () => {
    expect(() =>
      buildRatchetedBaseline(baseline, {
        fingerprints: ['x', 'x'],
        totals: { clones: 1, duplicatedLines: 5, percentage: 0.1 },
      }),
    ).toThrow(/ambiguous/i);
  });
});
