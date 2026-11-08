import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findNonIndexableOwnerCandidates, findPublicSitemapEntries, loggerError } = vi.hoisted(
  () => ({
    findNonIndexableOwnerCandidates: vi.fn<IQuizRepository['findNonIndexableOwnerCandidates']>(),
    findPublicSitemapEntries: vi.fn<IQuizRepository['findPublicSitemapEntries']>(),
    loggerError: vi.fn(),
  }),
);

// The real service applies the owner rule; only persistence is faked.
vi.mock('@/lib/quiz-factory', async () => {
  const { QuizAdminService } = await import('@/services/quiz/QuizAdminService');
  const repository: Partial<IQuizRepository> = {
    findNonIndexableOwnerCandidates,
    findPublicSitemapEntries,
  };
  const service = new QuizAdminService(repository as IQuizRepository);
  return { getQuizService: () => service };
});

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerError },
}));

import type {
  IQuizRepository,
  PublicQuizSitemapQuery,
} from '@/interfaces/repositories/IQuizRepository';
import { PUBLIC_CATALOG_OWNER_EMAILS } from '@/shared/constants/analytics-exclusions';
import sitemap from './sitemap';
import { GET as localeSitemapGET } from './[locale]/sitemap.xml/route';

interface FakeQuiz {
  slug: string;
  title?: string;
  description?: string;
  authorId: string;
  createdAt: Date;
  updatedAt?: Date;
}

function serveQuizzes(quizzes: FakeQuiz[]) {
  findPublicSitemapEntries.mockImplementation(
    async ({ excludeAuthorIds, limit }: PublicQuizSitemapQuery) =>
      quizzes
        .filter((quiz) => !excludeAuthorIds.includes(quiz.authorId))
        .slice(0, limit)
        .map(({ slug, title, description, createdAt, updatedAt }) => ({
          slug,
          title: title ?? 'Fake quiz',
          ...(description ? { description } : {}),
          createdAt,
          ...(updatedAt ? { updatedAt } : {}),
        })),
  );
}

describe('sitemap', () => {
  beforeEach(() => {
    findNonIndexableOwnerCandidates.mockReset().mockResolvedValue([]);
    findPublicSitemapEntries.mockReset();
    loggerError.mockReset();
  });

  it('lists only the canonical quiz slug, never a former slug alias', async () => {
    // The sitemap query projects the canonical slug only, never `slugAliases`.
    serveQuizzes([
      {
        slug: 'cach-ghi-nho-quiz-096007',
        authorId: 'learner-1',
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
        updatedAt: new Date('2026-11-02T00:00:00.000Z'),
      },
    ]);

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

  // RIN-840: QA and company-owned public quizzes stay out of the sitemap;
  // learners' quizzes and the public catalog (starter quizzes) stay in.
  it('drops test-owned public quizzes and keeps learner and catalog quizzes', async () => {
    findNonIndexableOwnerCandidates.mockResolvedValue([
      { id: 'qa-owner', email: 'qa-run@fldubai.com', isTestAccount: false },
      { id: 'flagged-owner', email: 'tester@gmail.com', isTestAccount: true },
      { id: 'catalog-owner', email: PUBLIC_CATALOG_OWNER_EMAILS[0] ?? '', isTestAccount: false },
    ]);
    const createdAt = new Date('2026-11-01T00:00:00.000Z');
    serveQuizzes([
      { slug: 'photosynthesis-qa-w45-retest-000001', authorId: 'qa-owner', createdAt },
      { slug: 'flagged-account-quiz-000002', authorId: 'flagged-owner', createdAt },
      { slug: 'learner-biology-quiz-000003', authorId: 'learner-1', createdAt },
      { slug: 'starter-english-quiz-000004', authorId: 'catalog-owner', createdAt },
    ]);

    const urls = (await sitemap()).map((entry) => entry.url).join('\n');
    const xml = await (await localeSitemapGET()).text();

    expect(findPublicSitemapEntries).toHaveBeenCalledWith({
      excludeAuthorIds: ['qa-owner', 'flagged-owner'],
      limit: 5000,
    });
    for (const output of [urls, xml]) {
      expect(output).toContain('/quiz/learner-biology-quiz-000003');
      expect(output).toContain('/quiz/starter-english-quiz-000004');
      expect(output).not.toContain('photosynthesis-qa-w45-retest-000001');
      expect(output).not.toContain('flagged-account-quiz-000002');
    }
  });

  it('returns static routes when dynamic quiz generation is unavailable', async () => {
    findPublicSitemapEntries.mockRejectedValue(new Error('database unavailable'));

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

  // RIN-1265: a Vietnamese quiz is listed only under /vi, with hreflang for vi
  // alone, so /en URLs never advertise Vietnamese content.
  it('lists a Vietnamese quiz only under /vi and keeps both locales for others', async () => {
    const createdAt = new Date('2026-11-01T00:00:00.000Z');
    serveQuizzes([
      {
        slug: 'cach-ghi-nho-quiz-khoi-dong-7-cau-096007',
        title: 'Cách ghi nhớ những gì bạn học',
        authorId: 'learner-1',
        createdAt,
      },
      {
        slug: 'lich-su-quiz-000010',
        title: 'Lich su',
        description: 'Ôn tập chương một',
        authorId: 'learner-1',
        createdAt,
      },
      { slug: 'cell-biology-000011', title: 'Cell biology', authorId: 'learner-1', createdAt },
    ]);

    const entries = await sitemap();
    const quizUrls = entries.map((entry) => entry.url).filter((url) => url.includes('/quiz/'));
    const xml = await (await localeSitemapGET()).text();

    expect(quizUrls).toEqual([
      expect.stringMatching(/\/en\/quiz\/cell-biology-000011$/),
      expect.stringMatching(/\/vi\/quiz\/cach-ghi-nho-quiz-khoi-dong-7-cau-096007$/),
      expect.stringMatching(/\/vi\/quiz\/cell-biology-000011$/),
      expect.stringMatching(/\/vi\/quiz\/lich-su-quiz-000010$/),
    ]);
    const viQuiz = entries.find((entry) => entry.url.endsWith('/vi/quiz/lich-su-quiz-000010'));
    expect(viQuiz?.alternates?.languages).toEqual({
      vi: expect.stringMatching(/\/vi\/quiz\/lich-su-quiz-000010$/),
      'x-default': expect.stringMatching(/\/vi\/quiz\/lich-su-quiz-000010$/),
    });
    expect(xml).not.toContain('/en/quiz/cach-ghi-nho');
    expect(xml).not.toContain('/en/quiz/lich-su');
    expect(xml).toContain('hreflang="en" href="http');
    expect(xml).toMatch(/hreflang="en" href="[^"]*\/en\/quiz\/cell-biology-000011"/);
  });
});
