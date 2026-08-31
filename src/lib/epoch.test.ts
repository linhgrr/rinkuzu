import { describe, expect, it } from 'vitest';

import { toTimestampMs } from './epoch';

describe('toTimestampMs', () => {
  it('passes a millisecond timestamp through', () => {
    const milliseconds = Date.UTC(2026, 7, 31, 12, 0, 0);

    expect(toTimestampMs(milliseconds)).toBe(milliseconds);
  });

  it('scales a second timestamp up', () => {
    const milliseconds = Date.UTC(2026, 7, 31, 12, 0, 0);

    expect(toTimestampMs(milliseconds / 1000)).toBe(milliseconds);
  });

  it('puts the boundary where 10^12 milliseconds is, not a round year', () => {
    // 10^12 ms is 2001-09-09; anything below it must have been seconds.
    expect(toTimestampMs(999_999_999_999)).toBe(999_999_999_999_000);
    expect(toTimestampMs(1_000_000_000_000)).toBe(1_000_000_000_000);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['zero, which every payload here means as absent', 0],
    ['a negative value', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('rejects %s', (_label, value) => {
    expect(toTimestampMs(value)).toBeNull();
  });
});
