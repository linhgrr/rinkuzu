import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const quizProgressMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
}));

const starterMocks = vi.hoisted(() => ({
  attemptExists: vi.fn(),
  quizExists: vi.fn(),
  quizAggregate: vi.fn(),
  starterFind: vi.fn(),
}));

vi.mock('@/models/Attempt', () => ({ default: { exists: starterMocks.attemptExists } }));
vi.mock('@/models/Quiz', () => ({
  default: { exists: starterMocks.quizExists, aggregate: starterMocks.quizAggregate },
}));
vi.mock('@/models/StarterQuiz', () => ({ default: { find: starterMocks.starterFind } }));
vi.mock('@/models/PremiumQuizSubmission', () => ({
  default: { collection: { collectionName: 'premiumquizsubmissions' } },
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/QuestionProgress', () => ({ default: {} }));
vi.mock('@/models/UserProgress', () => ({ default: {} }));
vi.mock('@/models/QuizProgress', () => ({
  default: { aggregate: quizProgressMocks.aggregate },
}));

import { DashboardRepository } from '@/repositories/DashboardRepository';

describe('DashboardRepository.findInProgressQuizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quizProgressMocks.aggregate.mockResolvedValue([]);
  });

  it('loads in-progress quiz summaries in one aggregation without saved answers', async () => {
    const userId = '507f191e810c19729de860ea';
    const repository = new DashboardRepository();

    await expect(repository.findInProgressQuizzes(userId, 6)).resolves.toEqual([]);

    expect(quizProgressMocks.aggregate).toHaveBeenCalledWith([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $sort: { updatedAt: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: 'quizzes',
          localField: 'quiz',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1, title: 1, slug: 1 } }],
          as: 'quizDoc',
        },
      },
      { $unwind: '$quizDoc' },
      {
        $project: {
          answeredCount: 1,
          totalQuestions: 1,
          updatedAt: 1,
          quiz: {
            _id: '$quizDoc._id',
            title: '$quizDoc.title',
            slug: '$quizDoc.slug',
          },
        },
      },
    ]);
  });

  it('projects only _id, title, and slug inside the quizzes lookup before unwind', async () => {
    const userId = '507f191e810c19729de860ea';
    const repository = new DashboardRepository();

    await repository.findInProgressQuizzes(userId, 6);

    const pipeline = quizProgressMocks.aggregate.mock.calls[0]?.[0] as Array<
      Record<string, unknown>
    >;
    expect(pipeline).toBeDefined();

    const lookupIndex = pipeline.findIndex(
      (stage) =>
        typeof stage === 'object' &&
        stage !== null &&
        '$lookup' in stage &&
        (stage['$lookup'] as { from?: string }).from === 'quizzes',
    );
    expect(lookupIndex).toBeGreaterThanOrEqual(0);

    const unwindIndex = pipeline.findIndex(
      (stage) =>
        typeof stage === 'object' &&
        stage !== null &&
        '$unwind' in stage &&
        stage['$unwind'] === '$quizDoc',
    );
    expect(unwindIndex).toBeGreaterThan(lookupIndex);

    const lookupStage = pipeline[lookupIndex]?.['$lookup'] as {
      from: string;
      localField: string;
      foreignField: string;
      pipeline: Array<{ $project: Record<string, number> }>;
      as: string;
    };

    expect(lookupStage.pipeline).toEqual([{ $project: { _id: 1, title: 1, slug: 1 } }]);
    expect(lookupStage.pipeline[0]?.$project).toEqual({ _id: 1, title: 1, slug: 1 });
    expect(Object.keys(lookupStage.pipeline[0]?.$project ?? {})).toEqual(['_id', 'title', 'slug']);
  });

  it('returns an empty list for invalid user ids without aggregating', async () => {
    const repository = new DashboardRepository();

    await expect(repository.findInProgressQuizzes('not-a-valid-object-id', 6)).resolves.toEqual([]);

    expect(quizProgressMocks.aggregate).not.toHaveBeenCalled();
  });
});
describe('DashboardRepository starter quiz lookups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks for any attempt or authored quiz with exists()', async () => {
    starterMocks.attemptExists.mockResolvedValue(null);
    starterMocks.quizExists.mockResolvedValue({ _id: 'fake-quiz' });
    const repository = new DashboardRepository();

    await expect(repository.hasSubmittedAttempt('fake-user')).resolves.toBe(false);
    await expect(repository.hasAuthoredQuiz('fake-user')).resolves.toBe(true);

    expect(starterMocks.attemptExists).toHaveBeenCalledWith({ user: 'fake-user' });
    expect(starterMocks.quizExists).toHaveBeenCalledWith({ author: 'fake-user' });
  });

  it('lists starter rows in order and maps quiz ids to strings', async () => {
    const quizId = new Types.ObjectId();
    const exec = vi.fn().mockResolvedValue([{ quiz: quizId, locale: 'vi', order: 1 }]);
    const lean = vi.fn(() => ({ exec }));
    const sort = vi.fn(() => ({ lean }));
    starterMocks.starterFind.mockReturnValue({ sort });
    const repository = new DashboardRepository();

    await expect(repository.listStarterQuizEntries()).resolves.toEqual([
      { quizId: quizId.toString(), locale: 'vi', order: 1 },
    ]);
    expect(starterMocks.starterFind).toHaveBeenCalledWith(
      {},
      { _id: 0, quiz: 1, locale: 1, order: 1 },
    );
    expect(sort).toHaveBeenCalledWith({ order: 1 });
  });

  it('resolves starter quiz ids in one aggregation that projects a count, not question bodies', async () => {
    const quizId = new Types.ObjectId();
    starterMocks.quizAggregate.mockResolvedValue([
      {
        _id: quizId,
        slug: 'fake-a',
        title: 'Fake A',
        visibility: 'public',
        questionCount: 3,
        isPremium: false,
        personalDataFlagged: false,
        indexHold: false,
      },
    ]);
    const repository = new DashboardRepository();

    await expect(
      repository.findStarterQuizCandidates([quizId.toString(), 'not-an-id']),
    ).resolves.toEqual([
      {
        quizId: quizId.toString(),
        slug: 'fake-a',
        title: 'Fake A',
        visibility: 'public',
        questionCount: 3,
        isPremium: false,
        personalDataFlagged: false,
        indexHold: false,
      },
    ]);

    expect(starterMocks.quizAggregate).toHaveBeenCalledTimes(1);
    const pipeline = starterMocks.quizAggregate.mock.calls[0]?.[0] as Array<
      Record<string, Record<string, unknown>>
    >;
    expect(pipeline[0]).toEqual({ $match: { _id: { $in: [quizId] } } });
    expect(pipeline[1]?.['$lookup']).toMatchObject({
      from: 'premiumquizsubmissions',
      localField: '_id',
      foreignField: 'sourceQuiz',
      pipeline: [{ $match: { status: 'approved', active: true } }, { $project: { _id: 1 } }],
    });
    const projection = pipeline[2]?.['$project'] ?? {};
    expect(Object.keys(projection)).toEqual([
      '_id',
      'slug',
      'title',
      'visibility',
      'questionCount',
      'isPremium',
      'personalDataFlagged',
      'indexHold',
    ]);
    expect(projection).not.toHaveProperty('questions');
  });

  it('skips the database when no quiz id is valid', async () => {
    const repository = new DashboardRepository();

    await expect(repository.findStarterQuizCandidates([])).resolves.toEqual([]);
    await expect(repository.findStarterQuizCandidates(['not-an-id'])).resolves.toEqual([]);

    expect(starterMocks.quizAggregate).not.toHaveBeenCalled();
  });
});
