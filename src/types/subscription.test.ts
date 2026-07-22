import { describe, expect, it } from 'vitest';
import { DurationUtils } from './subscription';

describe('DurationUtils', () => {
  it('parses supported ISO 8601 durations', () => {
    expect(DurationUtils.parseToMonths('P1M')).toBe(1);
    expect(() => DurationUtils.parseToMonths('P3M')).toThrow('Unsupported ISO 8601 duration');
    expect(() => DurationUtils.parseToMonths('P1Y')).toThrow('Unsupported ISO 8601 duration');
    expect(() => DurationUtils.parseToMonths('PT0S')).toThrow('Unsupported ISO 8601 duration');
    expect(() => DurationUtils.parseToMonths('P1M-junk')).toThrow('Unsupported ISO 8601 duration');
  });

  it('calculates monthly end dates', () => {
    const start = new Date('2026-01-15T00:00:00Z');

    expect(DurationUtils.calculateEndDate(start, 'P1M').toISOString()).toBe(
      '2026-02-15T00:00:00.000Z',
    );
    expect(() => DurationUtils.calculateEndDate(start, 'PT0S')).toThrow(
      'Unsupported ISO 8601 duration',
    );
  });

  it('returns monthly metadata and rejects unsupported products', () => {
    expect(DurationUtils.getDurationInfo('P1M')).toEqual({
      iso8601: 'P1M',
      displayName: '1 Month',
      months: 1,
    });
    expect(() => DurationUtils.getDurationInfo('P2M')).toThrow('Unsupported subscription duration');
  });

  it('validates only supported ISO duration shapes', () => {
    expect(DurationUtils.isValidISO8601Duration('P1M')).toBe(true);
    expect(DurationUtils.isValidISO8601Duration('P2Y')).toBe(false);
    expect(DurationUtils.isValidISO8601Duration('PT0S')).toBe(false);
    expect(DurationUtils.isValidISO8601Duration('P1D')).toBe(false);
    expect(() => DurationUtils.parseToMonths('P1D')).toThrow('Unsupported ISO 8601 duration');
  });
});
