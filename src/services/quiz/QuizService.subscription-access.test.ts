import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QuizService } from './QuizService';
import { ServiceFactory } from '@/lib/serviceFactory';

vi.mock('@/lib/serviceFactory', () => ({
  ServiceFactory: {
    createSubscriptionService: vi.fn(),
  },
}));

function createQuizService(quiz: any) {
  const quizRepository = {
    findBySlug: vi.fn().mockResolvedValue(quiz),
  };
  const discussionRepository = {
    findByQuiz: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  };

  const service = new QuizService(
    quizRepository as any,
    {} as any,
    { findByEmail: vi.fn() } as any,
    { create: vi.fn() } as any,
    discussionRepository as any,
    {} as any,
  );

  return { service, quizRepository, discussionRepository };
}

const privateQuiz = {
  _id: { toString: () => 'quiz-1' },
  author: { _id: { toString: () => 'author-1' } },
  status: 'published',
  isPrivate: true,
  questions: [
    {
      type: 'single',
      question: 'Q1',
      options: ['A', 'B'],
      correctIndex: 0,
    },
  ],
};

describe('QuizService subscription access gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks anonymous attempts against private quizzes', async () => {
    const { service } = createQuizService(privateQuiz);

    const result = await service.submitQuizAttempt('private-quiz', [0], null, 'anon@example.com');

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toBe('Authentication required to access private quiz');
  });

  it('blocks discussion reads for non-premium users on private quizzes', async () => {
    vi.mocked(ServiceFactory.createSubscriptionService).mockReturnValue({
      isUserPremium: vi.fn().mockResolvedValue(false),
    } as any);
    const { service, discussionRepository } = createQuizService(privateQuiz);

    const result = await service.getQuizDiscussions('private-quiz', {
      user: { id: 'user-1', role: 'user' },
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.error).toBe('Premium subscription required to access private quizzes');
    expect(discussionRepository.findByQuiz).not.toHaveBeenCalled();
  });

  it('allows discussion reads for premium users on private quizzes', async () => {
    vi.mocked(ServiceFactory.createSubscriptionService).mockReturnValue({
      isUserPremium: vi.fn().mockResolvedValue(true),
    } as any);
    const { service, discussionRepository } = createQuizService(privateQuiz);
    discussionRepository.create.mockResolvedValue({ questionIndex: 0 });

    const result = await service.getQuizDiscussions('private-quiz', {
      user: { id: 'user-1', role: 'user' },
    });

    expect(result.success).toBe(true);
    expect(discussionRepository.findByQuiz).toHaveBeenCalledWith('quiz-1');
    expect(discussionRepository.create).toHaveBeenCalledOnce();
  });
});
