import { describe, expect, it } from 'vitest';
import { formatDateTime } from '@/lib/formatters';

describe('formatDateTime', () => {
  it('uses the application timezone by default', () => {
    expect(formatDateTime('2026-07-02T00:00:00.000Z')).toBe('07:00 02/07/2026');
  });

  it('keeps explicit formatter options authoritative', () => {
    expect(
      formatDateTime('2026-07-02T00:00:00.000Z', {
        options: {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        },
      }),
    ).toBe('00:00 02/07/2026');
  });
});
