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
import { GET as localeSitemapGET } from './[locale]/sitemap.xml/route';

describe('sitemap', () => {
  it('lists only the canonical quiz slug, never a former slug alias', async () => {
    getQuizzes.mockResolvedValue({
      quizzes: [
        {
          slug: 'cach-ghi-nho-quiz-096007',
          slugAliases: ['cch-ghi-nh-quiz-096007'],
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-02T00:00:00.000Z',
        },
      ],
    });

    const urls = (await sitemap()).map((entry) => entry.url);
    const xml = await (await localeSitemapGET()).text();

    expect(urls.filter((url) => url.includes('/quiz/'))).toEqual([
      expect.stringMatching(/\/en\/quiz\/cach-ghi-nho-quiz-096007$/),
      expect.stringMatching(/\/vi\/quiz\/cach-ghi-nho-quiz-096007$/),
    ]);
    expect(xml).toContain('/vi/quiz/cach-ghi-nho-quiz-096007');
    for (const output of [urls.join('\n'), xml]) {
      expect(output).not.toContain('cch-ghi-nh-quiz-096007');
    }
  });

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
