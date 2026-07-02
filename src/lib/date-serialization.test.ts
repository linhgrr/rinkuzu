import { describe, expect, it } from 'vitest';
import { serializeDate, serializeOptionalDate, toUtcDateKey } from '@/lib/date-serialization';

describe('date serialization', () => {
  it('serializes valid dates as ISO 8601', () => {
    expect(serializeDate(new Date('2026-07-01T02:00:00Z'), 'createdAt')).toBe(
      '2026-07-01T02:00:00.000Z',
    );
  });

  it('keeps absent optional dates absent', () => {
    expect(serializeOptionalDate(undefined, 'endDate')).toBeUndefined();
    expect(serializeOptionalDate(null, 'endDate')).toBeUndefined();
  });

  it('serializes valid dates as UTC date keys', () => {
    expect(toUtcDateKey(new Date('2026-07-01T23:59:00Z'), 'updatedAt')).toBe('2026-07-01');
  });

  it('rejects invalid dates at the DTO boundary', () => {
    expect(() => serializeDate(new Date('invalid'), 'createdAt')).toThrow(
      'createdAt must be a valid Date',
    );
    expect(() => toUtcDateKey(new Date('invalid'), 'updatedAt')).toThrow(
      'updatedAt must be a valid Date',
    );
  });
});
