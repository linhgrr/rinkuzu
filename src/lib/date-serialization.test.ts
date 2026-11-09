import { describe, expect, it } from 'vitest';
import {
  assumeUtcWhenNoOffset,
  serializeDate,
  serializeOptionalDate,
  toUtcDateKey,
} from '@/lib/date-serialization';

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

// RIN-1272: the adaptive API sends UTC date-times without an offset, which Date reads as local.
describe('assumeUtcWhenNoOffset', () => {
  it.each([
    ['2026-11-08T20:06:00', '2026-11-08T20:06:00Z'],
    ['2026-11-08T20:06', '2026-11-08T20:06Z'],
    ['2026-11-08T20:06:00.123456', '2026-11-08T20:06:00.123456Z'],
  ])('marks the naive date-time %s as UTC', (input, expected) => {
    expect(assumeUtcWhenNoOffset(input)).toBe(expected);
    expect(new Date(assumeUtcWhenNoOffset(input)).getUTCHours()).toBe(20);
  });

  it.each([
    '2026-11-08T20:06:00Z',
    '2026-11-08T20:06:00.000Z',
    '2026-11-09T03:06:00+07:00',
    '2026-11-08T15:06:00-0500',
    '2026-11-08',
    'not a date',
    '',
  ])('leaves %j unchanged', (input) => {
    expect(assumeUtcWhenNoOffset(input)).toBe(input);
  });
});
