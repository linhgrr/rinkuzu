import { describe, expect, it } from 'vitest';
import { requireFirstNonEmptyString } from '@/lib/non-empty-string';

describe('requireFirstNonEmptyString', () => {
  it('returns the first non-empty string without trimming the value', () => {
    expect(requireFirstNonEmptyString('title', '', '  Rin  ', 'Kuzu')).toBe('  Rin  ');
  });

  it('throws when every candidate is empty', () => {
    expect(() => requireFirstNonEmptyString('title', '', '   ')).toThrow(
      'title must include at least one non-empty string',
    );
  });
});
