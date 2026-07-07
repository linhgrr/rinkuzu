import { describe, expect, it } from 'vitest';
import { DurationUtils } from './subscription';

describe('DurationUtils', () => {
  it('parses supported ISO 8601 durations', () => {
    expect(DurationUtils.parseToMonths('P1M')).toBe(1);
    expect(DurationUtils.parseToMonths('P3M')).toBe(3);
    expect(DurationUtils.parseToMonths('P1Y')).toBe(12);
    expect(DurationUtils.parseToMonths('PT0S')).toBeUndefined();
    expect(() => DurationUtils.parseToMonths('P1M-junk')).toThrow('Unsupported ISO 8601 duration');
  });

  it('calculates end dates and lifetime subscriptions', () => {
    const start = new Date('2026-01-15T00:00:00Z');

    expect(DurationUtils.calculateEndDate(start, 'P1M').toISOString()).toBe(
      '2026-02-15T00:00:00.000Z',
    );
    // Lifetime → far-future sentinel (not undefined) so expiry checks stay uniform.
    expect(DurationUtils.calculateEndDate(start, 'PT0S').toISOString()).toBe(
      '9999-12-31T23:59:59.999Z',
    );
  });

  it('returns predefined and custom duration metadata', () => {
    expect(DurationUtils.getDurationInfo('P6M')).toMatchObject({
      iso8601: 'P6M',
      displayName: '6 Months',
      months: 6,
    });
    expect(DurationUtils.getDurationInfo('P2M')).toEqual({
      iso8601: 'P2M',
      displayName: '2 Months',
      months: 2,
    });
  });

  it('validates only supported ISO duration shapes', () => {
    expect(DurationUtils.isValidISO8601Duration('P1M')).toBe(true);
    expect(DurationUtils.isValidISO8601Duration('P2Y')).toBe(true);
    expect(DurationUtils.isValidISO8601Duration('PT0S')).toBe(true);
    expect(DurationUtils.isValidISO8601Duration('P1D')).toBe(false);
    expect(() => DurationUtils.parseToMonths('P1D')).toThrow('Unsupported ISO 8601 duration');
  });
});
