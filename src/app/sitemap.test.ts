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
  authorId: string;
  createdAt: Date;
  updatedAt?: Date;
  title?: string;
  questionCount?: number;
  leadQuestionTexts?: string[];
}

function serveQuizzes(quizzes: FakeQuiz[]) {
  findPublicSitemapEntries.mockImplementation(
    async ({ excludeAuthorIds, limit }: PublicQuizSitemapQuery) =>
      quizzes
        .filter((quiz) => !excludeAuthorIds.includes(quiz.authorId))
        .slice(0, limit)
        .map(({ slug, createdAt, updatedAt, title, questionCount, leadQuestionTexts }) => ({
          slug,
          title: title ?? 'Ôn tập sinh học',
          questionCount: questionCount ?? 10,
          leadQuestionTexts: leadQuestionTexts ?? ['Quang hợp diễn ra ở đâu?'],
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

  // RIN-1241 D13/D14: each indexable quiz once, at its content-locale URL,
  // without an hreflang pair; thin quizzes stay out.
  it('lists each quiz once at its content-locale URL, without hreflang', async () => {
    const createdAt = new Date('2026-11-01T00:00:00.000Z');
    serveQuizzes([
      {
        slug: 'chuong-1-ktpm-000010',
        authorId: 'learner-1',
        createdAt,
        title: 'chuong 1 ktpm',
        leadQuestionTexts: ['Kiểm thử phần mềm là gì?', 'Mục tiêu của kiểm thử đơn vị?'],
      },
      {
        slug: 'intro-to-ai-000011',
        authorId: 'learner-2',
        createdAt,
        title: 'Intro to AI',
        leadQuestionTexts: ['What is a neural network?'],
      },
      { slug: 'four-question-quiz-000012', authorId: 'learner-3', createdAt, questionCount: 4 },
    ]);

    const quizEntries = (await sitemap()).filter((entry) => entry.url.includes('/quiz/'));
    const xml = await (await localeSitemapGET()).text();

    expect(quizEntries.map((entry) => new URL(entry.url).pathname)).toEqual([
      '/en/quiz/intro-to-ai-000011',
      '/vi/quiz/chuong-1-ktpm-000010',
    ]);
    expect(quizEntries.every((entry) => entry.alternates === undefined)).toBe(true);
    expect(xml).not.toContain('four-question-quiz-000012');
    expect(xml).not.toContain('/en/quiz/chuong-1-ktpm-000010');
    expect(xml).not.toContain('/vi/quiz/intro-to-ai-000011');
    const quizUrlBlocks = xml.split('</url>').filter((block) => block.includes('/quiz/'));
    expect(quizUrlBlocks).toHaveLength(2);
    for (const block of quizUrlBlocks) expect(block).not.toContain('hreflang');
    // Static pages keep their hreflang pair.
    expect(xml).toMatch(/hreflang="x-default"/);
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
});
