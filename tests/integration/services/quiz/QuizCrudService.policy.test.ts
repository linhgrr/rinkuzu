import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { QuizCrudService } from '@/services/quiz/QuizCrudService';

const subscriptionMocks = vi.hoisted(() => ({
  isUserPremium: vi.fn(),
}));

vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: () => ({
    isUserPremium: subscriptionMocks.isUserPremium,
  }),
}));

describe('QuizCrudService quiz publication policy', () => {
  const quizRepository = {
    findBySlug: vi.fn(),
    create: vi.fn(),
  } as unknown as IQuizRepository;
  const userRepository = {
    findById: vi.fn(),
  } as unknown as IUserRepository;

  const request = {
    title: 'Published immediately',
    folderId: null,
    questions: [
      {
        question: 'Question?',
        options: ['A', 'B'],
        type: 'single' as const,
        correctIndex: 0,
      },
    ],
    isPrivate: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(quizRepository.findBySlug).mockResolvedValue(null);
    vi.mocked(quizRepository.create).mockImplementation(async (quiz) => quiz as never);
    vi.mocked(userRepository.findById).mockResolvedValue({
      _id: 'user-1',
      role: 'user',
    } as never);
    subscriptionMocks.isUserPremium.mockResolvedValue(false);
  });

  it('publishes a new public quiz without admin approval', async () => {
    const service = new QuizCrudService(quizRepository, userRepository);

    await service.createQuiz('user-1', request);

    expect(quizRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
        isPrivate: false,
      }),
    );
  });

  it('rejects private quiz creation for a free user', async () => {
    const service = new QuizCrudService(quizRepository, userRepository);

    await expect(service.createQuiz('user-1', { ...request, isPrivate: true })).rejects.toThrow(
      'Premium subscription required to create private quizzes',
    );
    expect(quizRepository.create).not.toHaveBeenCalled();
  });

  it('allows a premium user to create a private quiz', async () => {
    subscriptionMocks.isUserPremium.mockResolvedValue(true);
    const service = new QuizCrudService(quizRepository, userRepository);

    await service.createQuiz('user-1', { ...request, isPrivate: true });

    expect(quizRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
        isPrivate: true,
      }),
    );
  });

  it('allows an admin to create a private quiz without a subscription lookup', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      _id: 'admin-1',
      role: 'admin',
    } as never);
    const service = new QuizCrudService(quizRepository, userRepository);

    await service.createQuiz('admin-1', { ...request, isPrivate: true });

    expect(subscriptionMocks.isUserPremium).not.toHaveBeenCalled();
    expect(quizRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isPrivate: true }),
    );
  });
});
