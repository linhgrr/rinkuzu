import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import type { Discussion } from '@/entities/Discussion';
import type { Report } from '@/entities/Report';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import type { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { QuizDiscussionService } from '@/services/quiz/QuizDiscussionService';
import { logger } from '@/lib/logger';
import type { Session } from 'next-auth';

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

const now = new Date('2026-07-03T10:00:00.000Z');
const quizId = '507f191e810c19729de860ea';
const userId = '507f191e810c19729de860eb';
const authorId = '507f191e810c19729de860ec';
const questionId = '507f191e810c19729de860ed';

function quizSummary(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: quizId,
    title: 'Algorithms',
    slug: 'algorithms',
    author: authorId,
    questions: [
      {
        id: questionId,
        question: 'What does stable mean?',
        options: ['Preserves order', 'Runs in O(1)'],
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
    comments: [
      {
        id: 'comment-1',
        author: {
          id: userId,
          displayName: 'Learner',
        },
        content: 'Helpful',
        isEdited: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function report(overrides: Partial<Report> = {}): Report {
  return {
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
    ...overrides,
  };
}

function sessionUser(overrides: Partial<NonNullable<Session['user']>> = {}): Session {
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

function createService() {
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
    create: vi.fn().mockResolvedValue(report()),
    update: vi.fn(),
    delete: vi.fn(),
  };

  return {
    service: new QuizDiscussionService(quizRepository, discussionRepository, reportRepository),
    quizRepository,
    discussionRepository,
    reportRepository,
  };
}

describe('QuizDiscussionService mutation coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getQuizDiscussions', () => {
    it('maps discussions and rejects missing quizzes', async () => {
      const { service, quizRepository, discussionRepository } = createService();
      discussionRepository.findByQuiz.mockResolvedValue([
        discussion({
          id: 'discussion-2',
          questionIndex: 1,
          comments: [
            {
              id: 'c-2',
              author: {
                id: userId,
                displayName: 'Learner',
              },
              content: 'Second',
              isEdited: false,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
      ]);

      const ok = await service.getQuizDiscussions('algorithms', sessionUser());
      expect(ok).toEqual({
        success: true,
        data: [
          {
            id: 'discussion-2',
            questionIndex: 1,
            comments: [
              {
                id: 'c-2',
                author: {
                  id: userId,
                  name: 'Learner',
                },
                content: 'Second',
                isEdited: false,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
              },
            ],
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ],
      });
      expect(quizRepository.findSummaryBySlug).toHaveBeenCalledWith('algorithms');

      quizRepository.findSummaryBySlug.mockResolvedValueOnce(null);
      await expect(service.getQuizDiscussions('missing')).resolves.toEqual({
        success: false,
        error: 'Quiz not found',
        statusCode: 404,
      });
      expect(discussionRepository.findByQuiz).toHaveBeenCalledTimes(1);
    });

    it('requires auth for personal sources and still works without a session for public ones', async () => {
      const { service, quizRepository, discussionRepository } = createService();
      quizRepository.findSummaryBySlug.mockResolvedValue(
        quizSummary({ visibility: 'personal', author: authorId }),
      );

      await expect(service.getQuizDiscussions('algorithms')).resolves.toEqual({
        success: false,
        error: 'Authentication required to access personal quiz source',
        statusCode: 401,
      });
      expect(discussionRepository.findByQuiz).not.toHaveBeenCalled();

      quizRepository.findSummaryBySlug.mockResolvedValue(quizSummary({ visibility: 'public' }));
      await expect(service.getQuizDiscussions('algorithms', null)).resolves.toMatchObject({
        success: true,
      });
    });

    it('returns a 500 when listing discussions throws', async () => {
      const { service, discussionRepository } = createService();
      discussionRepository.findByQuiz.mockRejectedValue(new Error('db fail'));

      await expect(service.getQuizDiscussions('algorithms')).resolves.toEqual({
        success: false,
        error: 'Failed to fetch discussions',
        statusCode: 500,
      });
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Get quiz discussions error',
      );
    });
  });

  describe('addDiscussionComment', () => {
    it('rejects access failures before validating the question index', async () => {
      const { service, quizRepository, discussionRepository } = createService();
      quizRepository.findSummaryBySlug.mockResolvedValue(null);

      await expect(
        service.addDiscussionComment('missing', 0, 'hi', sessionUser()),
      ).resolves.toEqual({
        success: false,
        error: 'Quiz not found',
        statusCode: 404,
      });
      expect(discussionRepository.addCommentForQuizQuestion).not.toHaveBeenCalled();
    });

    it('rejects negative and out-of-range question indexes using questionCount', async () => {
      const { service, discussionRepository } = createService();

      await expect(
        service.addDiscussionComment('algorithms', -1, 'hi', sessionUser()),
      ).resolves.toEqual({
        success: false,
        error: 'Invalid question index',
        statusCode: 400,
      });
      await expect(
        service.addDiscussionComment('algorithms', 3, 'hi', sessionUser()),
      ).resolves.toEqual({
        success: false,
        error: 'Invalid question index',
        statusCode: 400,
      });
      expect(discussionRepository.addCommentForQuizQuestion).not.toHaveBeenCalled();

      await expect(
        service.addDiscussionComment('algorithms', 2, 'edge', sessionUser()),
      ).resolves.toMatchObject({ success: true });
      expect(discussionRepository.addCommentForQuizQuestion).toHaveBeenCalledWith(quizId, 2, {
        authorId: userId,
        content: 'edge',
      });
    });

    it('rejects a missing user id with 401 and never writes a comment', async () => {
      const { service, discussionRepository, quizRepository } = createService();

      await expect(service.addDiscussionComment('algorithms', 0, 'hi', null)).resolves.toEqual({
        success: false,
        error: 'Authentication required',
        statusCode: 401,
      });

      const stripped = sessionMissingUserId({ expires: '2026-07-04T00:00:00.000Z' });
      await expect(service.addDiscussionComment('algorithms', 0, 'hi', stripped)).resolves.toEqual({
        success: false,
        error: 'Authentication required',
        statusCode: 401,
      });

      const userWithoutId = sessionMissingUserId({
        expires: '2026-07-04T00:00:00.000Z',
        user: { email: 'learner@example.com', role: 'user' },
      });
      await expect(
        service.addDiscussionComment('algorithms', 0, 'hi', userWithoutId),
      ).resolves.toEqual({
        success: false,
        error: 'Authentication required',
        statusCode: 401,
      });

      expect(quizRepository.findSummaryBySlug).not.toHaveBeenCalled();
      expect(discussionRepository.addCommentForQuizQuestion).not.toHaveBeenCalled();
    });

    it('returns 500 when the repository fails to add a comment', async () => {
      const { service, discussionRepository } = createService();
      discussionRepository.addCommentForQuizQuestion.mockResolvedValue(null);

      await expect(
        service.addDiscussionComment('algorithms', 0, 'hi', sessionUser()),
      ).resolves.toEqual({
        success: false,
        error: 'Failed to add comment',
        statusCode: 500,
      });
    });

    it('returns a 500 when adding a comment throws', async () => {
      const { service, discussionRepository } = createService();
      discussionRepository.addCommentForQuizQuestion.mockRejectedValue(new Error('write fail'));

      await expect(
        service.addDiscussionComment('algorithms', 0, 'hi', sessionUser()),
      ).resolves.toEqual({
        success: false,
        error: 'Failed to add comment',
        statusCode: 500,
      });
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Add discussion comment error',
      );
    });

    it('authors comments with the authenticated session user id', async () => {
      const { service, discussionRepository } = createService();
      const session = sessionUser({ id: '507f191e810c19729de860ed' });

      await service.addDiscussionComment('algorithms', 1, 'From session', session);

      expect(discussionRepository.addCommentForQuizQuestion).toHaveBeenCalledWith(quizId, 1, {
        authorId: '507f191e810c19729de860ed',
        content: 'From session',
      });
    });
  });

  describe('reportQuiz', () => {
    it('returns 404 when the quiz summary is missing', async () => {
      const { service, quizRepository, reportRepository } = createService();
      quizRepository.findForPlay.mockResolvedValue(null);

      await expect(
        service.reportQuiz('missing', questionId, 'content', 'r@example.com', 'R'),
      ).resolves.toEqual({
        success: false,
        error: 'Quiz not found',
        statusCode: 404,
      });
      expect(reportRepository.create).not.toHaveBeenCalled();
    });

    it('requires non-empty trimmed report content', async () => {
      const { service, reportRepository } = createService();

      for (const content of ['', '   ', '\n\t']) {
        await expect(
          service.reportQuiz('algorithms', questionId, content, 'r@example.com', 'R'),
        ).resolves.toEqual({
          success: false,
          error: 'Report content is required',
          statusCode: 400,
        });
      }
      expect(reportRepository.create).not.toHaveBeenCalled();
    });

    it('trims content, sets pending status, and maps the created report id', async () => {
      const { service, reportRepository } = createService();
      reportRepository.create.mockResolvedValue(report({ id: 'report-99' }));

      await expect(
        service.reportQuiz('algorithms', questionId, '  spoiler  ', 'r@example.com', 'Reporter'),
      ).resolves.toEqual({
        success: true,
        data: { reportId: 'report-99' },
      });
      expect(reportRepository.create).toHaveBeenCalledWith({
        quizId,
        quizTitle: 'Algorithms',
        quizSlug: 'algorithms',
        questionId,
        questionSnapshot: {
          id: questionId,
          index: 0,
          question: 'What does stable mean?',
          options: ['Preserves order', 'Runs in O(1)'],
          type: 'single',
          correctIndex: 0,
        },
        reporterEmail: 'r@example.com',
        reporterName: 'Reporter',
        content: 'spoiler',
        status: 'pending',
      });
    });

    it('denies non-owners reporting personal quiz sources', async () => {
      const { service, quizRepository, reportRepository } = createService();
      quizRepository.findForPlay.mockResolvedValue(
        quizSummary({ visibility: 'personal', author: authorId }),
      );
      await expect(
        service.reportQuiz(
          'algorithms',
          questionId,
          'broken',
          'r@example.com',
          'R',
          sessionUser({ id: userId, role: 'user' }),
        ),
      ).resolves.toEqual({
        success: false,
        error: 'Personal quiz sources are only available to their owner or an admin',
        statusCode: 403,
      });
      expect(reportRepository.create).not.toHaveBeenCalled();
    });

    it.each([
      ['author', authorId, 'user' as const],
      ['admin', userId, 'admin' as const],
    ])('allows %s to report a personal quiz source', async (_label, reporterId, role) => {
      const { service, quizRepository, reportRepository } = createService();
      quizRepository.findForPlay.mockResolvedValue(
        quizSummary({ visibility: 'personal', author: authorId }),
      );
      await expect(
        service.reportQuiz(
          'algorithms',
          questionId,
          'broken',
          'r@example.com',
          'R',
          sessionUser({ id: reporterId, role }),
        ),
      ).resolves.toEqual({
        success: true,
        data: { reportId: 'report-1' },
      });
      expect(reportRepository.create).toHaveBeenCalled();
    });

    it('returns a 500 when report creation throws', async () => {
      const { service, reportRepository } = createService();
      reportRepository.create.mockRejectedValue(new Error('insert fail'));

      await expect(
        service.reportQuiz('algorithms', questionId, 'bad key', 'r@example.com', 'R'),
      ).resolves.toEqual({
        success: false,
        error: 'Failed to report quiz',
        statusCode: 500,
      });
      expect(logger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Report quiz error');
    });
  });
});
