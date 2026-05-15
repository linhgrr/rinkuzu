import { describe, expect, it, vi } from 'vitest';

import {
  calculateScore,
  cn,
  formatDate,
  generateSlug,
  getErrorMessage,
  truncateText,
} from './utils';

describe('utils', () => {
  it('generates a slug with a deterministic suffix shape', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1714201234567);

    expect(generateSlug('Hello World!')).toBe('hello-world-234567');
  });

  it('calculates score using only answered questions', () => {
    expect(
      calculateScore(
        [1, -1, [0, 2]],
        [
          { type: 'single', correctIndex: 1 },
          { type: 'single', correctIndex: 2 },
          { type: 'multiple', correctIndexes: [0, 2] },
        ],
      ),
    ).toBe(100);
  });

  it('returns 0 score when all questions are unanswered', () => {
    expect(
      calculateScore(
        [-1, []],
        [
          { type: 'single', correctIndex: 1 },
          { type: 'multiple', correctIndexes: [0, 2] },
        ],
      ),
    ).toBe(0);
  });

  it('counts multiple-choice answer as wrong when selection differs', () => {
    expect(calculateScore([[0, 1]], [{ type: 'multiple', correctIndexes: [0, 2] }])).toBe(0);
  });

  it('returns 0 when every answered question is wrong', () => {
    expect(
      calculateScore(
        [2, [3, 4]],
        [
          { type: 'single', correctIndex: 1 },
          { type: 'multiple', correctIndexes: [0, 2] },
        ],
      ),
    ).toBe(0);
  });

  it('ignores unanswered questions (skipped with -1)', () => {
    expect(
      calculateScore(
        [-1, 0, -1, 1],
        [
          { type: 'single', correctIndex: 0 },
          { type: 'single', correctIndex: 0 },
          { type: 'single', correctIndex: 0 },
          { type: 'single', correctIndex: 1 },
        ],
      ),
    ).toBe(100); // Only 2 answered, both correct
  });

  it('handles unsorted multiple-choice selections correctly', () => {
    expect(calculateScore([[2, 0]], [{ type: 'multiple', correctIndexes: [0, 2] }])).toBe(100);
  });

  it('scores partial multiple-choice as wrong', () => {
    expect(calculateScore([[0]], [{ type: 'multiple', correctIndexes: [0, 2] }])).toBe(0);
  });

  it('handles an empty user answers and questions array', () => {
    expect(calculateScore([], [])).toBe(0);
  });

  it('merges class names with tailwind precedence', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('formats date with locale options', () => {
    const date = new Date('2025-01-01T10:30:00.000Z');
    const formatted = formatDate(date, 'en-US');
    expect(formatted).toContain('2025');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('truncates long text', () => {
    expect(truncateText('abcdef', 4)).toBe('abcd...');
    expect(truncateText('abc', 4)).toBe('abc');
  });

  it('normalizes unknown errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('boom')).toBe('An unknown error occurred');
  });
});
