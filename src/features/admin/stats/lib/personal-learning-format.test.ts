import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatDateTimeUtc,
  formatPercent,
} from '@/features/admin/stats/lib/personal-learning-format';

describe('personal learning format', () => {
  it('groups counts the same way on the server and in every browser', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1234567)).toBe('1,234,567');
  });

  it('rounds ratios to whole percents', () => {
    expect(formatPercent(0.666)).toBe('67%');
  });

  it('shows timestamps in UTC and a dash when there is none', () => {
    expect(formatDateTimeUtc('2026-10-30T23:45:00Z')).toBe('30 Oct 2026, 23:45 UTC');
    expect(formatDateTimeUtc(null)).toBe('—');
    expect(formatDateTimeUtc('not a date')).toBe('—');
  });
});
