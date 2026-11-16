import { describe, expect, it } from 'vitest';

import { trailingIsoWeeks } from '@/lib/analytics/iso-week';
import { buildActivationBreakdown } from '@/services/admin/activation-breakdown';

const NOW = new Date('2026-11-12T00:00:00.000Z');
const windows = trailingIsoWeeks(NOW, 1);
const weekStart = windows[0]?.start ?? NOW;

function row(segment: string | null, signups: number, activated = 0, startedQuiz = 0) {
  return { weekStart, segment, signups, activated, startedQuiz };
}

function build(records: ReturnType<typeof row>[]) {
  return buildActivationBreakdown({
    by: 'source',
    windows,
    records,
    now: NOW,
    adaptive: 'ok',
  });
}

describe('buildActivationBreakdown by=source', () => {
  it('keeps the top 10 buckets by signups, folds the rest into other, unknown last', () => {
    const named = Array.from({ length: 12 }, (_, index) => row(`src${index}`, 20 - index, 1, 2));
    const result = build([...named, row(null, 4, 0, 1), row('Bad Value!', 1, 1, 1)]);
    expect(result.segments).toEqual([
      ...Array.from({ length: 10 }, (_, index) => `src${index}`),
      'other',
      'unknown',
    ]);
    const week = result.weeks[0]?.segments ?? {};
    // src10 (10 signups) and src11 (9) fold into other.
    expect(week['other']).toEqual({ signups: 19, activated: 2, startedQuiz: 4 });
    // A value that is not a stored utm / referrer_class value counts as unknown.
    expect(week['unknown']).toEqual({ signups: 5, activated: 1, startedQuiz: 2 });
  });

  it('sums every metric to the week total and merges rows sharing a key', () => {
    const result = build([
      row('threads', 2, 1, 2),
      row('threads', 3, 0, 1),
      row('search', 4, 2, 3),
    ]);
    const segments = result.weeks[0]?.segments ?? {};
    const cells = Object.values(segments);
    expect(segments['threads']).toEqual({
      signups: 5,
      activated: 1,
      startedQuiz: 3,
    });
    expect(cells.reduce((sum, cell) => sum + cell.signups, 0)).toBe(9);
    expect(cells.reduce((sum, cell) => sum + (cell.startedQuiz ?? 0), 0)).toBe(6);
  });
});
