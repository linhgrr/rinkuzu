import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { assertOk, assertFail } from '../../../helpers/service-result-assert';

import { QuizService } from '@/services/quiz/QuizService';
import type { Discussion } from '@/entities/Discussion';
import type { Quiz } from '@/entities/Quiz';
import type { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import type { IQuizProgressRepository } from '@/interfaces/repositories/IQuizProgressRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';

function createQuizService(quiz: Quiz) {
  const quizRepository: Mocked<IQuizRepository> = {
    findById: vi.fn(),
    findAccessById: vi.fn(),
    findBySlug: vi.fn().mockResolvedValue(quiz),
    findSummaryBySlug: vi.fn().mockResolvedValue({
      ...quiz,
      questions: [],
      questionCount: quiz.questionCount ?? quiz.questions.length,
    }),
    findIdBySlug: vi.fn().mockResolvedValue(quiz.id),
    findCanonicalSlugByAlias: vi.fn(),
    findBySourceDraftId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    findForPlay: vi.fn().mockResolvedValue(quiz),
    findUserQuizzes: vi.fn(),
    findPublicByAuthor: vi.fn(),
    findMetadataBySlug: vi.fn(),
    findNonIndexableOwnerCandidates: vi.fn(),
    findPublicSitemapEntries: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    findTopCreators: vi.fn(),
  };
  const userRepository: Mocked<IUserRepository> = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByIdIncludingDisabled: vi.fn(),
    findPublicProfileById: vi.fn(),
    applyAdminMutation: vi.fn(),
    findAll: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    countByRole: vi.fn(),
  };
  const discussionRepository: Mocked<IDiscussionRepository> = {
    findByQuiz: vi.fn().mockResolvedValue([]),
    addCommentForQuizQuestion: vi.fn(),
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
  };
  const attemptProgressRepository: Mocked<IQuizAttemptProgressRepository> = {
    recordSubmittedAttempt: vi.fn(),
  };

  const service = new QuizService(
    quizRepository,
    userRepository,
    discussionRepository,
    reportRepository,
    progressRepository,
    attemptProgressRepository,
  );

  return { service, quizRepository, discussionRepository };
}

const personalQuiz: Quiz = {
  id: 'quiz-1',
  title: 'Personal quiz source',
  slug: 'personal-quiz-source',
  author: { id: 'author-1' },
  visibility: 'personal',
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

describe('QuizService personal source access gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks anonymous attempts against personal sources', async () => {
    const { service } = createQuizService(personalQuiz);

    const result = await service.submitQuizAttempt(
      'personal-quiz-source',
      [0],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
      null,
      'anon@example.com',
    );

    assertFail(result);
    expect(result.statusCode).toBe(401);
    expect(result.error).toBe('Authentication required to access personal quiz source');
  });

  it('blocks discussion reads for non-owners on personal sources', async () => {
    const { service, discussionRepository } = createQuizService(personalQuiz);

    const result = await service.getQuizDiscussions('personal-quiz-source', {
      user: { id: 'user-1', role: 'user', emailVerified: true },
      expires: '2099-01-01',
    });

    assertFail(result);
    expect(result.statusCode).toBe(403);
    expect(result.error).toBe(
      'Personal quiz sources are only available to their owner or an admin',
    );
    expect(discussionRepository.findByQuiz).not.toHaveBeenCalled();
  });

  it('allows discussion reads for the owner of a personal source', async () => {
    const { service, discussionRepository } = createQuizService(personalQuiz);
    const createdDiscussion: Discussion = {
      id: 'discussion-1',
      quiz: 'quiz-1',
      questionIndex: 0,
      comments: [],
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    };
    discussionRepository.findByQuiz.mockResolvedValue([createdDiscussion]);

    const result = await service.getQuizDiscussions('personal-quiz-source', {
      user: { id: 'author-1', role: 'user', emailVerified: true },
      expires: '2099-01-01',
    });

    assertOk(result);
    expect(discussionRepository.findByQuiz).toHaveBeenCalledWith('quiz-1');
    expect(discussionRepository.addCommentForQuizQuestion).not.toHaveBeenCalled();
  });
});
