import { describe, expect, it } from 'vitest';
import type {
  QuizTopicAssignmentRecord,
  QuizTopicRecord,
} from '@/interfaces/repositories/IQuizTopicAdminRepository';
import type {
  IQuizTopicHubRepository,
  QuizTopicHubQuizRecord,
} from '@/interfaces/repositories/IQuizTopicHubRepository';
import type { QuizOwnerIndexingRecord } from '@/interfaces/repositories/IQuizRepository';
import { QuizTopicHubService } from './QuizTopicHubService';

const INTRO_150_WORDS = Array.from({ length: 150 }, (_, i) => `từ${i}`).join(' ');

function topic(overrides: Partial<QuizTopicRecord> = {}): QuizTopicRecord {
  return {
    id: 'topic-sinh',
    slug: 'sinh-hoc',
    locale: 'vi',
    name: 'Sinh học',
    intro: INTRO_150_WORDS,
    order: 1,
    published: true,
    ...overrides,
  };
}

function quiz(id: string, overrides: Partial<QuizTopicHubQuizRecord> = {}): QuizTopicHubQuizRecord {
  return {
    id,
    slug: `de-${id}`,
    title: `Đề ${id}`,
    visibility: 'public',
    authorId: 'author-real',
    questionCount: 10,
    personalDataFlagged: false,
    indexHold: false,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

function assign(topicId: string, quizIds: readonly string[]): QuizTopicAssignmentRecord[] {
  return quizIds.map((quizId, index) => ({
    id: `a-${topicId}-${quizId}`,
    quizId,
    topicId,
    order: index + 1,
  }));
}

interface FakeData {
  topics: QuizTopicRecord[];
  assignments: QuizTopicAssignmentRecord[];
  quizzes: QuizTopicHubQuizRecord[];
  owners?: QuizOwnerIndexingRecord[];
}

function buildService(data: FakeData) {
  const calls = { quizLookups: 0, ownerLookups: 0 };
  const hubRepository: IQuizTopicHubRepository = {
    findPublishedTopicBySlug: async (slug) =>
      data.topics.find((t) => t.slug === slug && t.published) ?? null,
    findPublishedTopicByQuizId: async (quizId) => {
      const topicId = data.assignments.find((a) => a.quizId === quizId)?.topicId;
      return data.topics.find((t) => t.id === topicId && t.published) ?? null;
    },
    listPublishedTopics: async () =>
      data.topics.filter((t) => t.published).sort((a, b) => a.order - b.order),
    listAssignmentsByTopicIds: async (topicIds) =>
      data.assignments.filter((a) => topicIds.includes(a.topicId)),
    findPublicQuizzesByIds: async (quizIds) => {
      calls.quizLookups += 1;
      return data.quizzes.filter((q) => quizIds.includes(q.id) && q.visibility === 'public');
    },
  };
  const service = new QuizTopicHubService({
    hubRepository,
    ownerRepository: {
      findNonIndexableOwnerCandidates: async () => {
        calls.ownerLookups += 1;
        return data.owners ?? [];
      },
    },
  });
  return { service, calls };
}

describe('QuizTopicHubService.getTopicWithIndexableQuizzes', () => {
  it('returns the topic with its indexable quizzes in assignment order', async () => {
    const { service } = buildService({
      topics: [topic()],
      assignments: assign('topic-sinh', ['q3', 'q1', 'q2']),
      quizzes: [
        quiz('q1'),
        quiz('q2', { updatedAt: new Date('2026-11-02T00:00:00.000Z') }),
        quiz('q3'),
      ],
    });

    const hub = await service.getTopicWithIndexableQuizzes('sinh-hoc');

    expect(hub).toEqual({
      slug: 'sinh-hoc',
      locale: 'vi',
      name: 'Sinh học',
      intro: INTRO_150_WORDS,
      indexable: true,
      quizzes: [
        { slug: 'de-q3', title: 'Đề q3', questionCount: 10, updatedAt: '2026-10-01T00:00:00.000Z' },
        { slug: 'de-q1', title: 'Đề q1', questionCount: 10, updatedAt: '2026-10-01T00:00:00.000Z' },
        { slug: 'de-q2', title: 'Đề q2', questionCount: 10, updatedAt: '2026-11-02T00:00:00.000Z' },
      ],
    });
  });

  it('returns null for an unknown slug and for a draft topic', async () => {
    const { service } = buildService({
      topics: [topic({ published: false })],
      assignments: [],
      quizzes: [],
    });

    await expect(service.getTopicWithIndexableQuizzes('sinh-hoc')).resolves.toBeNull();
    await expect(service.getTopicWithIndexableQuizzes('khong-co')).resolves.toBeNull();
  });

  it('drops private, thin, deleted and test-owned quizzes, then judges the hub on the rest', async () => {
    const { service } = buildService({
      topics: [topic()],
      assignments: assign('topic-sinh', ['ok1', 'private', 'thin', 'deleted', 'test', 'ok2']),
      quizzes: [
        quiz('ok1'),
        quiz('private', { visibility: 'private' }),
        quiz('thin', { questionCount: 4 }),
        quiz('test', { authorId: 'author-test' }),
        quiz('ok2', { authorId: null }),
      ],
      owners: [
        { id: 'author-test', email: 'qa@example.test', isTestAccount: true },
        { id: 'author-real', email: 'learner@gmail.com', isTestAccount: false },
      ],
    });

    const hub = await service.getTopicWithIndexableQuizzes('sinh-hoc');

    expect(hub?.quizzes.map(({ slug }) => slug)).toEqual(['de-ok1', 'de-ok2']);
    expect(hub?.indexable).toBe(false);
  });

  // RIN-1341: flagged or held quizzes stay playable but never appear on a hub.
  it('drops quizzes flagged for personal data or under a report hold', async () => {
    const { service } = buildService({
      topics: [topic()],
      assignments: assign('topic-sinh', ['ok1', 'flagged', 'held']),
      quizzes: [
        quiz('ok1'),
        quiz('flagged', { personalDataFlagged: true }),
        quiz('held', { indexHold: true }),
      ],
      owners: [],
    });

    const hub = await service.getTopicWithIndexableQuizzes('sinh-hoc');

    expect(hub?.quizzes.map(({ slug }) => slug)).toEqual(['de-ok1']);
  });

  it('is not indexable when the intro is too short, even with enough quizzes', async () => {
    const { service } = buildService({
      topics: [topic({ intro: 'Ngắn quá.' })],
      assignments: assign('topic-sinh', ['q1', 'q2', 'q3']),
      quizzes: [quiz('q1'), quiz('q2'), quiz('q3')],
    });

    const hub = await service.getTopicWithIndexableQuizzes('sinh-hoc');

    expect(hub?.quizzes).toHaveLength(3);
    expect(hub?.indexable).toBe(false);
  });

  it('skips the quiz and owner lookups for a topic with no quizzes', async () => {
    const { service, calls } = buildService({ topics: [topic()], assignments: [], quizzes: [] });

    const hub = await service.getTopicWithIndexableQuizzes('sinh-hoc');

    expect(hub?.quizzes).toEqual([]);
    expect(hub?.indexable).toBe(false);
    expect(calls).toEqual({ quizLookups: 0, ownerLookups: 0 });
  });
});

describe('QuizTopicHubService.listIndexableTopics', () => {
  it('lists only indexable published topics, in order, with counts and the newest change', async () => {
    const { service, calls } = buildService({
      topics: [
        topic({ id: 't-toan', slug: 'toan', name: 'Toán', order: 2 }),
        topic(),
        topic({ id: 't-draft', slug: 'nhap', name: 'Nháp', order: 0, published: false }),
        topic({ id: 't-few', slug: 'it-de', name: 'Ít đề', order: 3 }),
      ],
      assignments: [
        ...assign('topic-sinh', ['s1', 's2', 's3']),
        ...assign('t-toan', ['m1', 'm2', 'm3', 'm4']),
        ...assign('t-draft', ['d1', 'd2', 'd3']),
        ...assign('t-few', ['f1', 'f2']),
      ],
      quizzes: [
        quiz('s1'),
        quiz('s2', { updatedAt: new Date('2026-11-05T00:00:00.000Z') }),
        quiz('s3'),
        quiz('m1'),
        quiz('m2'),
        quiz('m3'),
        quiz('m4', { questionCount: 2 }),
        quiz('d1'),
        quiz('d2'),
        quiz('d3'),
        quiz('f1'),
        quiz('f2'),
      ],
    });

    const topics = await service.listIndexableTopics();

    expect(topics).toEqual([
      {
        slug: 'sinh-hoc',
        locale: 'vi',
        name: 'Sinh học',
        indexableQuizCount: 3,
        lastModified: '2026-11-05T00:00:00.000Z',
      },
      {
        slug: 'toan',
        locale: 'vi',
        name: 'Toán',
        indexableQuizCount: 3,
        lastModified: '2026-10-01T00:00:00.000Z',
      },
    ]);
    // One batched quiz query and one owner query for every topic together.
    expect(calls).toEqual({ quizLookups: 1, ownerLookups: 1 });
  });

  it('dates a hub by its topic edit when that is newer than every quiz (D15)', async () => {
    const { service } = buildService({
      topics: [topic({ updatedAt: new Date('2026-11-09T08:00:00.000Z') })],
      assignments: assign('topic-sinh', ['s1', 's2', 's3']),
      quizzes: [quiz('s1'), quiz('s2'), quiz('s3')],
    });

    const [hub] = await service.listIndexableTopics();

    expect(hub?.lastModified).toBe('2026-11-09T08:00:00.000Z');
  });

  it('returns an empty list when nothing is published', async () => {
    const { service, calls } = buildService({
      topics: [topic({ published: false })],
      assignments: [],
      quizzes: [],
    });

    await expect(service.listIndexableTopics()).resolves.toEqual([]);
    expect(calls).toEqual({ quizLookups: 0, ownerLookups: 0 });
  });
});

describe('QuizTopicHubService.getQuizTopicContext', () => {
  it('returns the topic and its other indexable quizzes in hub order, capped', async () => {
    const { service } = buildService({
      topics: [topic()],
      assignments: assign('topic-sinh', ['q1', 'q2', 'q3', 'q4', 'q5']),
      quizzes: [quiz('q1'), quiz('q2', { questionCount: 3 }), quiz('q3'), quiz('q4'), quiz('q5')],
    });

    await expect(service.getQuizTopicContext('q3', 2)).resolves.toEqual({
      slug: 'sinh-hoc',
      name: 'Sinh học',
      quizzes: [
        expect.objectContaining({ slug: 'de-q1' }),
        expect.objectContaining({ slug: 'de-q4' }),
      ],
    });
  });

  it('keeps the topic when the quiz is the only indexable one in it', async () => {
    const { service } = buildService({
      topics: [topic()],
      assignments: assign('topic-sinh', ['q1']),
      quizzes: [quiz('q1')],
    });

    await expect(service.getQuizTopicContext('q1', 6)).resolves.toEqual({
      slug: 'sinh-hoc',
      name: 'Sinh học',
      quizzes: [],
    });
  });

  it('returns null for a quiz without a published topic', async () => {
    const { service, calls } = buildService({
      topics: [topic({ published: false })],
      assignments: assign('topic-sinh', ['q1']),
      quizzes: [quiz('q1')],
    });

    await expect(service.getQuizTopicContext('q1', 6)).resolves.toBeNull();
    await expect(service.getQuizTopicContext('q-none', 6)).resolves.toBeNull();
    expect(calls).toEqual({ quizLookups: 0, ownerLookups: 0 });
  });
});
