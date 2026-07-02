import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { assertOk, assertFail } from '@/interfaces/services/types';

import { QuizService } from '@/services/quiz/QuizService';
import type { Discussion } from '@/entities/Discussion';
import type { Quiz } from '@/entities/Quiz';
import type { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import type { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import type { IQuizProgressRepository } from '@/interfaces/repositories/IQuizProgressRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';

const subscriptionMocks = vi.hoisted(() => ({
  isUserPremium: vi.fn(),
}));

vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: () => ({
    isUserPremium: subscriptionMocks.isUserPremium,
  }),
}));

function createQuizService(quiz: Quiz) {
  const quizRepository: Mocked<IQuizRepository> = {
    findById: vi.fn(),
    findBySlug: vi.fn().mockResolvedValue(quiz),
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
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findPublicProfileById: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    countByRole: vi.fn(),
  };
  const attemptRepository: Mocked<IAttemptRepository> = {
    findByUser: vi.fn(),
    create: vi.fn(),
    countByUser: vi.fn(),
    countByQuiz: vi.fn(),
    findRecentActivity: vi.fn(),
    findByIdWithQuiz: vi.fn(),
    count: vi.fn(),
    countByTakenAtBuckets: vi.fn(),
  };
  const discussionRepository: Mocked<IDiscussionRepository> = {
    findById: vi.fn(),
    findByQuiz: vi.fn().mockResolvedValue([]),
    ensureForQuizQuestions: vi.fn(),
    ensureForQuizQuestion: vi.fn(),
    addComment: vi.fn(),
  };
  const reportRepository: Mocked<IReportRepository> = {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const progressRepository: Mocked<IQuizProgressRepository> = {
    upsert: vi.fn(),
    findByUserAndQuiz: vi.fn(),
    deleteByUserAndQuiz: vi.fn(),
    findInProgressByUser: vi.fn(),
  };

  const service = new QuizService(
    quizRepository,
    userRepository,
    attemptRepository,
    discussionRepository,
    reportRepository,
    progressRepository,
  );

  return { service, quizRepository, discussionRepository };
}

const privateQuiz: Quiz = {
  id: 'quiz-1',
  title: 'Private quiz',
  slug: 'private-quiz',
  author: { id: 'author-1' },
  isPrivate: true,
  questions: [
    {
      id: 'question-1',
      type: 'single',
      question: 'Q1',
      options: ['A', 'B'],
      correctIndex: 0,
    },
  ],
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T00:00:00Z'),
};

describe('QuizService subscription access gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks anonymous attempts against private quizzes', async () => {
    const { service } = createQuizService(privateQuiz);

    const result = await service.submitQuizAttempt('private-quiz', [0], null, 'anon@example.com');

    assertFail(result);
    expect(result.statusCode).toBe(401);
    expect(result.error).toBe('Authentication required to access private quiz');
  });

  it('blocks discussion reads for non-premium users on private quizzes', async () => {
    subscriptionMocks.isUserPremium.mockResolvedValue(false);
    const { service, discussionRepository } = createQuizService(privateQuiz);

    const result = await service.getQuizDiscussions('private-quiz', {
      user: { id: 'user-1', role: 'user' },
      expires: '2099-01-01',
    });

    assertFail(result);
    expect(result.statusCode).toBe(403);
    expect(result.error).toBe('Premium subscription required to access private quizzes');
    expect(discussionRepository.findByQuiz).not.toHaveBeenCalled();
  });

  it('allows discussion reads for premium users on private quizzes', async () => {
    subscriptionMocks.isUserPremium.mockResolvedValue(true);
    const { service, discussionRepository } = createQuizService(privateQuiz);
    const createdDiscussion: Discussion = {
      id: 'discussion-1',
      quiz: 'quiz-1',
      questionIndex: 0,
      comments: [],
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    };
    discussionRepository.ensureForQuizQuestions.mockResolvedValue([createdDiscussion]);

    const result = await service.getQuizDiscussions('private-quiz', {
      user: { id: 'user-1', role: 'user' },
      expires: '2099-01-01',
    });

    assertOk(result);
    expect(discussionRepository.ensureForQuizQuestions).toHaveBeenCalledWith('quiz-1', 1);
    expect(discussionRepository.ensureForQuizQuestion).not.toHaveBeenCalled();
  });
});
