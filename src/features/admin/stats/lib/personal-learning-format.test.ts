import { describe, expect, it } from 'vitest';
import { formatCount, formatPercent } from '@/features/admin/stats/lib/personal-learning-format';

describe('personal learning format', () => {
  it('groups counts the same way on the server and in every browser', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1234567)).toBe('1,234,567');
  });

  it('rounds ratios to whole percents', () => {
    expect(formatPercent(0.666)).toBe('67%');
  });
});
