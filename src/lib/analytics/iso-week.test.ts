import { describe, expect, it } from 'vitest';
import { trailingIsoWeeks } from './iso-week';

function weekOf(iso: string) {
  const [week] = trailingIsoWeeks(new Date(iso), 1);
  if (!week) throw new Error('expected one week');
  return week;
}

describe('iso-week', () => {
  it('starts weeks on Monday 00:00 UTC', () => {
    // Sunday 2026-11-01 23:59:59.999 belongs to the week starting Monday 2026-10-26.
    expect(weekOf('2026-11-01T23:59:59.999Z').start.toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(weekOf('2026-11-02T00:00:00.000Z').start.toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });

  it.each([
    ['2026-10-26T00:00:00.000Z', '2026-W44'],
    ['2026-12-31T12:00:00.000Z', '2026-W53'],
    ['2027-01-03T23:59:59.999Z', '2026-W53'],
    ['2027-01-04T00:00:00.000Z', '2027-W01'],
    ['2025-12-29T00:00:00.000Z', '2026-W01'],
    ['2024-12-30T00:00:00.000Z', '2025-W01'],
    ['2021-01-03T00:00:00.000Z', '2020-W53'],
  ])('labels %s as %s', (iso, label) => {
    expect(weekOf(iso).isoWeek).toBe(label);
  });

  it('returns trailing weeks oldest first, ending with the current week', () => {
    const weeks = trailingIsoWeeks(new Date('2027-01-06T10:00:00.000Z'), 3);
    expect(weeks.map((week) => week.isoWeek)).toEqual(['2026-W52', '2026-W53', '2027-W01']);
    expect(weeks[2]?.start.toISOString()).toBe('2027-01-04T00:00:00.000Z');
    expect(weeks[2]?.endExclusive.toISOString()).toBe('2027-01-11T00:00:00.000Z');
    expect(weeks[0]?.endExclusive.getTime()).toBe(weeks[1]?.start.getTime());
  });
});
