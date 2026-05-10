import { describe, expect, it, vi } from 'vitest';

import {
  calculateScore,
  cn,
  fileToBuffer,
  formatDate,
  generateSlug,
  getErrorMessage,
  truncateText,
  validateEmail,
  validatePassword,
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

  it('validates email format', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('invalid-email')).toBe(false);
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('test@')).toBe(false);
    expect(validateEmail('@test.com')).toBe(false);
    expect(validateEmail('user+tag@domain.co.uk')).toBe(true);
  });

  it('validates minimum password length', () => {
    expect(validatePassword('12345')).toBe(false);
    expect(validatePassword('123456')).toBe(true);
    expect(validatePassword('')).toBe(false);
    expect(validatePassword('a'.repeat(100))).toBe(true);
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

  it('converts file content to buffer', async () => {
    class SuccessFileReader {
      public result: ArrayBuffer | null = new Uint8Array([65, 66]).buffer;
      public error: Error | null = null;
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;

      readAsArrayBuffer(_file: File) {
        this.onload?.();
      }
    }

    vi.stubGlobal('FileReader', SuccessFileReader);

    const buffer = await fileToBuffer({} as File);
    expect(buffer.toString('utf8')).toBe('AB');
  });

  it('rejects when file reader returns non-arraybuffer result', async () => {
    class InvalidResultFileReader {
      public result: string | null = 'not-buffer';
      public error: Error | null = null;
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;

      readAsArrayBuffer(_file: File) {
        this.onload?.();
      }
    }

    vi.stubGlobal('FileReader', InvalidResultFileReader);

    await expect(fileToBuffer({} as File)).rejects.toThrow('Failed to read file as buffer');
  });

  it('rejects with file reader error', async () => {
    const fileReadError = new Error('read failed');

    class ErrorFileReader {
      public result: ArrayBuffer | null = null;
      public error: Error | null = fileReadError;
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;

      readAsArrayBuffer(_file: File) {
        this.onerror?.();
      }
    }

    vi.stubGlobal('FileReader', ErrorFileReader);

    await expect(fileToBuffer({} as File)).rejects.toThrow('read failed');
  });
});
