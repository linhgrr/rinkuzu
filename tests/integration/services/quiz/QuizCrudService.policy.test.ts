import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import type { User } from '@/entities/User';
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
  const quizRepository: Mocked<IQuizRepository> = {
    findById: vi.fn(),
    findBySlug: vi.fn(),
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
    vi.mocked(quizRepository.findBySourceDraftId).mockResolvedValue(null);
    vi.mocked(quizRepository.create).mockImplementation(
      async (quizData): Promise<Quiz> => ({
        id: 'quiz-1',
        title: quizData.title,
        slug: quizData.slug,
        author: quizData.author,
        questions: quizData.questions.map((question, index) => ({
          ...question,
          id: `question-${index + 1}`,
        })),
        isPrivate: quizData.isPrivate,
        description: quizData.description,
        folder: quizData.folder,
        pdfUrl: quizData.pdfUrl,
        sourceDraftId: quizData.sourceDraftId,
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-01T00:00:00Z'),
      }),
    );
    const user: User = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'user',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    vi.mocked(userRepository.findById).mockResolvedValue(user);
    subscriptionMocks.isUserPremium.mockResolvedValue(false);
  });

  it('creates a public quiz immediately', async () => {
    const service = new QuizCrudService(quizRepository, userRepository);

    await service.createQuiz('user-1', request);

    expect(quizRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
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
        isPrivate: true,
      }),
    );
  });

  it('allows an admin to create a private quiz without a subscription lookup', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const service = new QuizCrudService(quizRepository, userRepository);

    await service.createQuiz('admin-1', { ...request, isPrivate: true });

    expect(subscriptionMocks.isUserPremium).not.toHaveBeenCalled();
    expect(quizRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isPrivate: true }),
    );
  });

  it('retries slug creation from the database unique index instead of pre-querying slugs', async () => {
    vi.mocked(quizRepository.create).mockRejectedValueOnce({
      code: 11000,
      keyPattern: { slug: 1 },
      keyValue: { slug: 'published-immediately' },
    });
    const service = new QuizCrudService(quizRepository, userRepository);

    const created = await service.createQuiz('user-1', request);

    const firstAttempt = vi.mocked(quizRepository.create).mock.calls[0]?.[0];
    const secondAttempt = vi.mocked(quizRepository.create).mock.calls[1]?.[0];
    expect(firstAttempt?.slug).toMatch(/^published-immediately-\d{6}$/);
    expect(secondAttempt?.slug).toBe(`${firstAttempt?.slug}-1`);
    expect(created.slug).toBe(secondAttempt?.slug);
    expect(quizRepository.findBySlug).not.toHaveBeenCalled();
  });

  it('reuses the quiz already created for a draft', async () => {
    const existing = await quizRepository.create({
      title: request.title,
      slug: 'published-immediately',
      author: 'user-1',
      folder: null,
      questions: request.questions,
      isPrivate: false,
      sourceDraftId: 'draft-1',
    });
    vi.mocked(quizRepository.findBySourceDraftId).mockResolvedValue(existing);
    vi.mocked(quizRepository.create).mockClear();
    const service = new QuizCrudService(quizRepository, userRepository);

    await expect(service.createQuizFromDraft('user-1', 'draft-1', request)).resolves.toBe(existing);
    expect(quizRepository.create).not.toHaveBeenCalled();
  });

  it('recovers the concurrently-created quiz after the unique draft key wins', async () => {
    const concurrentlyCreated: Quiz = {
      id: 'quiz-concurrent',
      title: request.title,
      slug: 'published-immediately',
      author: 'user-1',
      folder: null,
      questions: request.questions.map((question, index) => ({
        ...question,
        id: `question-${index + 1}`,
      })),
      isPrivate: false,
      sourceDraftId: 'draft-1',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    };
    vi.mocked(quizRepository.findBySourceDraftId)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrentlyCreated);
    vi.mocked(quizRepository.create).mockRejectedValue({ code: 11000 });
    const service = new QuizCrudService(quizRepository, userRepository);

    await expect(service.createQuizFromDraft('user-1', 'draft-1', request)).resolves.toBe(
      concurrentlyCreated,
    );
  });
});
