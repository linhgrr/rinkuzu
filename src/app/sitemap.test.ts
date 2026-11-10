import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findNonIndexableOwnerCandidates, findPublicSitemapEntries, loggerError, hubData } =
  vi.hoisted(() => ({
    findNonIndexableOwnerCandidates: vi.fn<IQuizRepository['findNonIndexableOwnerCandidates']>(),
    findPublicSitemapEntries: vi.fn<IQuizRepository['findPublicSitemapEntries']>(),
    loggerError: vi.fn(),
    hubData: {
      topics: [] as QuizTopicRecord[],
      assignments: [] as QuizTopicAssignmentRecord[],
      quizzes: [] as QuizTopicHubQuizRecord[],
    },
  }));

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

// Topic hubs (RIN-1249): the real service applies B5, persistence is faked.
vi.mock('@/lib/quiz-topic-hub-factory', async () => {
  const { QuizTopicHubService } = await import('@/services/quiz/QuizTopicHubService');
  const hubRepository: IQuizTopicHubRepository = {
    findPublishedTopicBySlug: async (slug) =>
      hubData.topics.find((topic) => topic.slug === slug && topic.published) ?? null,
    findPublishedTopicByQuizId: async () => null,
    listPublishedTopics: async () => hubData.topics.filter((topic) => topic.published),
    listAssignmentsByTopicIds: async (ids) =>
      hubData.assignments.filter((assignment) => ids.includes(assignment.topicId)),
    findPublicQuizzesByIds: async (ids) => hubData.quizzes.filter((quiz) => ids.includes(quiz.id)),
  };
  const service = new QuizTopicHubService({
    hubRepository,
    ownerRepository: { findNonIndexableOwnerCandidates },
  });
  return { getQuizTopicHubService: () => service };
});

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerError },
}));

import type {
  IQuizRepository,
  PublicQuizSitemapQuery,
} from '@/interfaces/repositories/IQuizRepository';
import type {
  QuizTopicAssignmentRecord,
  QuizTopicRecord,
} from '@/interfaces/repositories/IQuizTopicAdminRepository';
import type {
  IQuizTopicHubRepository,
  QuizTopicHubQuizRecord,
} from '@/interfaces/repositories/IQuizTopicHubRepository';
import { INDEXABLE_STATIC_PUBLIC_ROUTES } from '@/lib/seo.routes';
import { STATIC_ROUTE_LASTMOD } from '@/lib/seo/static-lastmod';
import { canonicalFor } from '@/lib/seo';
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
    hubData.topics = [];
    hubData.assignments = [];
    hubData.quizzes = [];
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

  // RIN-1249 B5/D15: only hubs that pass `isTopicIndexable`, one vi URL each,
  // dated by the newest change of the topic or its quizzes.
  it('lists eligible topic hubs only, without hreflang', async () => {
    serveQuizzes([]);
    const intro = Array.from({ length: 130 }, (_, i) => `từ${i}`).join(' ');
    const topic = (id: string, slug: string, updatedAt?: Date): QuizTopicRecord => ({
      id,
      slug,
      locale: 'vi',
      name: slug,
      intro,
      order: 1,
      published: true,
      ...(updatedAt ? { updatedAt } : {}),
    });
    hubData.topics = [
      topic('t-sinh', 'sinh-hoc', new Date('2026-11-08T00:00:00.000Z')),
      topic('t-toan', 'toan'),
    ];
    const ids = { 't-sinh': ['s1', 's2', 's3'], 't-toan': ['m1', 'm2'] };
    hubData.assignments = Object.entries(ids).flatMap(([topicId, quizIds]) =>
      quizIds.map((quizId, index) => ({ id: `a-${quizId}`, topicId, quizId, order: index })),
    );
    hubData.quizzes = Object.values(ids)
      .flat()
      .map((id) => ({
        id,
        slug: `de-${id}`,
        title: `Đề ${id}`,
        visibility: 'public',
        authorId: 'learner-1',
        author: null,
        questionCount: 10,
        personalDataFlagged: false,
        indexHold: false,
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
      }));

    const hubEntries = (await sitemap()).filter((entry) => entry.url.includes('/explore/'));
    const xml = await (await localeSitemapGET()).text();

    expect(hubEntries).toEqual([
      {
        url: expect.stringMatching(/\/vi\/explore\/sinh-hoc$/),
        lastModified: new Date('2026-11-08T00:00:00.000Z'),
      },
    ]);
    expect(xml).toContain('/vi/explore/sinh-hoc');
    expect(xml).not.toContain('/explore/toan');
    expect(xml).not.toContain('/en/explore/sinh-hoc');
    expect(loggerError).not.toHaveBeenCalled();
  });

  // RIN-1499: lastmod is the last real content change, never the request time.
  describe('lastmod', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    const sitemapAt = async (iso: string) => {
      vi.setSystemTime(new Date(iso));
      return new Map(
        (await sitemap()).map((entry) => [
          entry.url,
          new Date(entry.lastModified ?? Number.NaN).toISOString(),
        ]),
      );
    };

    it('returns the same lastmod for every URL a minute and a day later', async () => {
      serveQuizzes([
        {
          slug: 'on-tap-sinh-hoc-000020',
          authorId: 'learner-1',
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          updatedAt: new Date('2026-10-05T08:30:00.000Z'),
        },
      ]);
      vi.useFakeTimers({ toFake: ['Date'] });

      const now = '2030-01-01T10:00:00.000Z';
      const first = await sitemapAt(now);
      const minuteLater = await sitemapAt('2030-01-01T10:01:00.000Z');
      const dayLater = await sitemapAt('2030-01-02T10:00:00.000Z');

      expect(first.size).toBeGreaterThan(INDEXABLE_STATIC_PUBLIC_ROUTES.length);
      expect(minuteLater).toEqual(first);
      for (const [url, lastModified] of first) {
        expect(dayLater.get(url), url).toBe(lastModified);
        // Content in the repo and the fake DB predates the faked "now".
        expect(lastModified < now, `${url} ${lastModified}`).toBe(true);
      }
      const quizUrl = [...first.keys()].find((url) => url.includes('/quiz/'));
      expect(quizUrl && first.get(quizUrl)).toBe('2026-10-05T08:30:00.000Z');
    });

    it('dates every static page by its constant; blog pages by their newest post', async () => {
      serveQuizzes([]);
      const byUrl = await sitemapAt(new Date().toISOString());

      expect(Object.keys(STATIC_ROUTE_LASTMOD).sort()).toEqual(
        [...INDEXABLE_STATIC_PUBLIC_ROUTES].sort(),
      );
      for (const route of INDEXABLE_STATIC_PUBLIC_ROUTES) {
        const constant = `${STATIC_ROUTE_LASTMOD[route]}T00:00:00.000Z`;
        expect(new Date(constant).toISOString(), route).toBe(constant);
        for (const locale of ['vi', 'en']) {
          const lastModified = byUrl.get(canonicalFor(locale, route));
          if (route.startsWith('/blog')) {
            expect(lastModified && lastModified >= constant, route).toBe(true);
          } else {
            expect(lastModified, route).toBe(constant);
          }
        }
      }
    });
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
