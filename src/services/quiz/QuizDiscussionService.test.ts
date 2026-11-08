import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { Session } from 'next-auth';
import type { Quiz } from '@/entities/Quiz';
import type { Discussion } from '@/entities/Discussion';
import type { Report } from '@/entities/Report';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import type { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { QuizDiscussionService } from '@/services/quiz/QuizDiscussionService';

const now = new Date('2026-07-03T10:00:00.000Z');
const quizId = '507f191e810c19729de860ea';
const userId = '507f191e810c19729de860eb';
const questionId = '507f191e810c19729de860ec';

function quizSummary(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: quizId,
    title: 'Algorithms',
    slug: 'algorithms',
    author: userId,
    questions: [
      {
        id: questionId,
        question: 'What is a stable sort?',
        options: ['Preserves equal-item order', 'Uses no memory'],
        type: 'single',
        correctIndex: 0,
      },
    ],
    questionCount: 3,
    visibility: 'public',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function discussion(overrides: Partial<Discussion> = {}): Discussion {
  return {
    id: 'discussion-1',
    quiz: quizId,
    questionIndex: 0,
    comments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function authenticatedSession(overrides: Partial<NonNullable<Session['user']>> = {}): Session {
  return {
    user: {
      id: userId,
      email: 'learner@example.com',
      role: 'user',
      ...overrides,
    },
    expires: '2026-07-04T00:00:00.000Z',
  };
}

/** Runtime session with no user id, built via unknown validation (no unsafe cast). */
function sessionMissingUserId(input: unknown): Session | null {
  if (input === null) {
    return null;
  }
  if (typeof input !== 'object') {
    throw new Error('session input must be an object or null');
  }
  if (!('expires' in input)) {
    throw new Error('session input must include expires');
  }
  const expires = Reflect.get(input, 'expires');
  if (typeof expires !== 'string') {
    throw new Error('session expires must be a string');
  }
  if (!('user' in input)) {
    return { expires };
  }
  const user = Reflect.get(input, 'user');
  if (user === undefined || user === null) {
    return { expires };
  }
  if (typeof user !== 'object') {
    throw new Error('session user must be an object when present');
  }
  if ('id' in user && Reflect.get(user, 'id') !== undefined) {
    throw new Error('sessionMissingUserId helper rejects inputs that include a user id');
  }
  return { expires };
}

function createService(premiumAllowed?: boolean) {
  const quizRepository: Mocked<IQuizRepository> = {
    findById: vi.fn(),
    findAccessById: vi.fn(),
    findBySlug: vi.fn(),
    findSummaryBySlug: vi.fn().mockResolvedValue(quizSummary()),
    findIdBySlug: vi.fn(),
    findCanonicalSlugByAlias: vi.fn(),
    findBySourceDraftId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    findForPlay: vi.fn().mockResolvedValue(quizSummary()),
    findUserQuizzes: vi.fn(),
    findPublicByAuthor: vi.fn(),
    findMetadataBySlug: vi.fn(),
    findNonIndexableOwnerCandidates: vi.fn(),
    findPublicSitemapEntries: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    findTopCreators: vi.fn(),
  };
  const discussionRepository: Mocked<IDiscussionRepository> = {
    findByQuiz: vi.fn().mockResolvedValue([discussion()]),
    addCommentForQuizQuestion: vi.fn().mockResolvedValue(discussion()),
  };
  const reportRepository: Mocked<IReportRepository> = {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn().mockResolvedValue({
      id: 'report-1',
      quizId,
      quizTitle: 'Algorithms',
      quizSlug: 'algorithms',
      reporterEmail: 'reporter@example.com',
      reporterName: 'Reporter',
      content: 'Wrong answer',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    } satisfies Report),
    update: vi.fn(),
    delete: vi.fn(),
  };

  return {
    service: new QuizDiscussionService(
      quizRepository,
      discussionRepository,
      reportRepository,
      premiumAllowed === undefined
        ? undefined
        : { canAccessPublishedQuiz: vi.fn().mockResolvedValue(premiumAllowed) },
    ),
    quizRepository,
    discussionRepository,
    reportRepository,
  };
}

describe('QuizDiscussionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads quiz metadata only when listing discussions', async () => {
    const { service, quizRepository, discussionRepository } = createService();

    const result = await service.getQuizDiscussions('algorithms');

    expect(result.success).toBe(true);
    expect(quizRepository.findSummaryBySlug).toHaveBeenCalledWith('algorithms');
    expect(quizRepository.findBySlug).not.toHaveBeenCalled();
    expect(discussionRepository.findByQuiz).toHaveBeenCalledWith(quizId);
  });

  it('uses quiz questionCount to validate comment question index', async () => {
    const { service, discussionRepository } = createService();

    const result = await service.addDiscussionComment(
      'algorithms',
      3,
      'Needs explanation',
      authenticatedSession(),
    );

    expect(result).toEqual({
      success: false,
      error: 'Invalid question index',
      statusCode: 400,
    });
    expect(discussionRepository.addCommentForQuizQuestion).not.toHaveBeenCalled();
  });

  it('uses the Premium publication policy for subscriber or credit-grant discussions', async () => {
    const { service, quizRepository, discussionRepository } = createService(true);
    quizRepository.findSummaryBySlug.mockResolvedValue(
      quizSummary({ visibility: 'personal', author: '507f191e810c19729de860ff' }),
    );

    const result = await service.getQuizDiscussions('algorithms', authenticatedSession());

    expect(result.success).toBe(true);
    expect(discussionRepository.findByQuiz).toHaveBeenCalledWith(quizId);
  });

  it('does not expose discussions for an unpublished personal source', async () => {
    const { service, quizRepository, discussionRepository } = createService(false);
    quizRepository.findSummaryBySlug.mockResolvedValue(
      quizSummary({ visibility: 'personal', author: '507f191e810c19729de860ff' }),
    );

    const result = await service.getQuizDiscussions('algorithms', authenticatedSession());

    expect(result).toMatchObject({ success: false, statusCode: 403 });
    expect(discussionRepository.findByQuiz).not.toHaveBeenCalled();
  });

  it('uses the authenticated user id and one atomic repository write when adding comments', async () => {
    const { service, discussionRepository } = createService();

    const result = await service.addDiscussionComment(
      'algorithms',
      0,
      'Needs explanation',
      authenticatedSession(),
    );

    expect(result.success).toBe(true);
    expect(discussionRepository.addCommentForQuizQuestion).toHaveBeenCalledWith(quizId, 0, {
      authorId: userId,
      content: 'Needs explanation',
    });
  });

  it('rejects a missing user id with 401 and never writes a comment', async () => {
    const { service, discussionRepository, quizRepository } = createService();
    const session = sessionMissingUserId({ expires: '2026-07-04T00:00:00.000Z' });

    const result = await service.addDiscussionComment(
      'algorithms',
      0,
      'Needs explanation',
      session,
    );

    expect(result).toEqual({
      success: false,
      error: 'Authentication required',
      statusCode: 401,
    });
    expect(quizRepository.findSummaryBySlug).not.toHaveBeenCalled();
    expect(discussionRepository.addCommentForQuizQuestion).not.toHaveBeenCalled();
  });

  it('creates a question-level report with a server-owned snapshot', async () => {
    const { service, quizRepository, reportRepository } = createService();

    const result = await service.reportQuiz(
      'algorithms',
      questionId,
      'Wrong answer',
      'reporter@example.com',
      'Reporter',
    );

    expect(result).toEqual({ success: true, data: { reportId: 'report-1' } });
    expect(quizRepository.findForPlay).toHaveBeenCalledWith('algorithms');
    expect(reportRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        quizId,
        quizTitle: 'Algorithms',
        quizSlug: 'algorithms',
        questionId,
        questionSnapshot: expect.objectContaining({
          id: questionId,
          index: 0,
          question: 'What is a stable sort?',
          correctIndex: 0,
        }),
      }),
    );
  });
});
