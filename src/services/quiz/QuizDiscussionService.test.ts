import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import type { Discussion } from '@/entities/Discussion';
import type { Report } from '@/entities/Report';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import type { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { QuizDiscussionService } from '@/services/quiz/QuizDiscussionService';

const now = new Date('2026-07-03T10:00:00.000Z');
const quizId = '507f191e810c19729de860ea';
const userId = '507f191e810c19729de860eb';

function quizSummary(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: quizId,
    title: 'Algorithms',
    slug: 'algorithms',
    author: userId,
    questions: [],
    questionCount: 3,
    isPrivate: false,
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

function createService() {
  const quizRepository: Mocked<IQuizRepository> = {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findSummaryBySlug: vi.fn().mockResolvedValue(quizSummary()),
    findIdBySlug: vi.fn(),
    findBySourceDraftId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    findForPlay: vi.fn(),
    findUserQuizzes: vi.fn(),
    findPublicByAuthor: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    findTopCreators: vi.fn(),
  };
  const userRepository: Mocked<IUserRepository> = {
    findByEmail: vi.fn().mockResolvedValue({
      id: userId,
      email: 'learner@example.com',
      role: 'user',
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    }),
    findById: vi.fn(),
    findPublicProfileById: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    count: vi.fn(),
    countByRole: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
  };
  const discussionRepository: Mocked<IDiscussionRepository> = {
    findById: vi.fn(),
    findByQuiz: vi.fn(),
    ensureForQuizQuestions: vi.fn().mockResolvedValue([discussion()]),
    ensureForQuizQuestion: vi.fn().mockResolvedValue(discussion()),
    addComment: vi.fn().mockResolvedValue(discussion()),
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
      userRepository,
      discussionRepository,
      reportRepository,
    ),
    quizRepository,
    userRepository,
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
    expect(discussionRepository.ensureForQuizQuestions).toHaveBeenCalledWith(quizId, 3);
  });

  it('uses quiz questionCount to validate comment question index', async () => {
    const { service, discussionRepository } = createService();

    const result = await service.addDiscussionComment(
      'algorithms',
      3,
      'Needs explanation',
      'learner@example.com',
    );

    expect(result).toEqual({
      success: false,
      error: 'Invalid question index',
      statusCode: 400,
    });
    expect(discussionRepository.ensureForQuizQuestion).not.toHaveBeenCalled();
  });

  it('creates reports from quiz metadata without loading questions', async () => {
    const { service, quizRepository, reportRepository } = createService();

    const result = await service.reportQuiz(
      'algorithms',
      'Wrong answer',
      'reporter@example.com',
      'Reporter',
    );

    expect(result).toEqual({ success: true, data: { reportId: 'report-1' } });
    expect(quizRepository.findSummaryBySlug).toHaveBeenCalledWith('algorithms');
    expect(quizRepository.findBySlug).not.toHaveBeenCalled();
    expect(reportRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        quizId,
        quizTitle: 'Algorithms',
        quizSlug: 'algorithms',
      }),
    );
  });
});
