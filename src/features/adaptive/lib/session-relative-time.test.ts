import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatSessionRelativeTime } from './session-relative-time';

const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);

/** Records the key and count instead of rendering a translation. */
const t = ((key: string, values?: Record<string, unknown>) =>
  values && 'count' in values ? `${key}:${String(values['count'])}` : key) as Parameters<
  typeof formatSessionRelativeTime
>[1];

afterEach(() => {
  vi.useRealTimers();
});

function at(msAgo: number) {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  return NOW - msAgo;
}

describe('formatSessionRelativeTime', () => {
  it('reports whole minutes under an hour', () => {
    expect(formatSessionRelativeTime(at(25 * 60_000), t)).toBe('minutesAgo:25');
  });

  it('never says zero minutes, so "just now" still reads as a duration', () => {
    expect(formatSessionRelativeTime(at(5_000), t)).toBe('minutesAgo:1');
  });

  it('switches to hours at sixty minutes', () => {
    expect(formatSessionRelativeTime(at(60 * 60_000), t)).toBe('hoursAgoShort:1');
    expect(formatSessionRelativeTime(at(23 * 60 * 60_000), t)).toBe('hoursAgoShort:23');
  });

  it('switches to days at twenty-four hours', () => {
    expect(formatSessionRelativeTime(at(24 * 60 * 60_000), t)).toBe('daysAgoShort:1');
    expect(formatSessionRelativeTime(at(9 * 24 * 60 * 60_000), t)).toBe('daysAgoShort:9');
  });

  it('accepts a second-based timestamp, which some payloads send', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    expect(formatSessionRelativeTime((NOW - 25 * 60_000) / 1000, t)).toBe('minutesAgo:25');
  });

  it('treats a future timestamp as the present rather than a negative duration', () => {
    expect(formatSessionRelativeTime(at(-60 * 60_000), t)).toBe('minutesAgo:1');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['zero', 0],
    ['NaN', Number.NaN],
  ])('falls back for %s instead of rendering NaN', (_label, value) => {
    expect(formatSessionRelativeTime(value, t)).toBe('minutesAgo:1');
  });
});
