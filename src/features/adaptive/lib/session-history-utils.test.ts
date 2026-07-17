import { describe, expect, it, vi } from 'vitest';

const { formatDateTimeMock } = vi.hoisted(() => ({
  formatDateTimeMock: vi.fn((ts: number, options?: { locale?: string; emptyLabel?: string }) => {
    return `fmt:${ts}:${options?.locale ?? 'default'}:${options?.emptyLabel ?? ''}`;
  }),
}));

vi.mock('@/lib/formatters', () => ({
  formatDateTime: formatDateTimeMock,
}));

import { formatSessionHistoryDate } from '@/features/adaptive/lib/session-history-utils';

describe('formatSessionHistoryDate', () => {
  it('returns an em dash for zero and other falsy timestamps without formatting', () => {
    expect(formatSessionHistoryDate(0)).toBe('—');
    expect(formatSessionHistoryDate(0, 'en-US')).toBe('—');
    expect(formatDateTimeMock).not.toHaveBeenCalled();
  });

  it('converts unix seconds to milliseconds and defaults locale to vi-VN', () => {
    expect(formatSessionHistoryDate(1_700_000_000)).toBe('fmt:1700000000000:vi-VN:—');
    expect(formatDateTimeMock).toHaveBeenCalledWith(1_700_000_000 * 1000, {
      locale: 'vi-VN',
      emptyLabel: '—',
    });
  });

  it('forwards a custom locale while still converting seconds to milliseconds', () => {
    expect(formatSessionHistoryDate(1_700_000_001, 'en-US')).toBe('fmt:1700000001000:en-US:—');
    expect(formatDateTimeMock).toHaveBeenCalledWith(1_700_000_001 * 1000, {
      locale: 'en-US',
      emptyLabel: '—',
    });
  });
});
