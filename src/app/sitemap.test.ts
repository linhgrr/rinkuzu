import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getQuizzes, loggerError } = vi.hoisted(() => ({
  getQuizzes: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({ getQuizzes }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerError },
}));

import sitemap from './sitemap';

describe('sitemap', () => {
  beforeEach(() => {
    getQuizzes.mockReset();
    loggerError.mockReset();
  });

  it('returns static routes when dynamic quiz generation is unavailable', async () => {
    getQuizzes.mockRejectedValue(new Error('database unavailable'));

    const entries = await sitemap();

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.url.endsWith('/en'))).toBe(true);
    expect(entries.find((entry) => entry.url.endsWith('/vi'))?.alternates?.languages).toEqual({
      vi: expect.stringMatching(/\/vi$/),
      en: expect.stringMatching(/\/en$/),
      'x-default': expect.stringMatching(/\/vi$/),
    });
    expect(loggerError).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'sitemap: quiz generation failed',
    );
  });
});
