import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { assertOk, assertFail } from '@/interfaces/services/types';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { User } from '@/entities/User';
import type { Attempt } from '@/entities/Attempt';
import type { QuizQuestion } from '@/entities/Quiz';
import { UserService } from './UserService';

interface ServiceOverrides {
  userRepository?: Partial<Mocked<IUserRepository>>;
  attemptRepository?: Partial<Mocked<IAttemptRepository>>;
  quizRepository?: Partial<Mocked<IQuizRepository>>;
}

function userFixture(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@test.com',
    role: 'user',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function questionFixture(id: string, correctIndex = 0): QuizQuestion {
  return {
    id,
    question: `Question ${id}`,
    options: ['A', 'B', 'C'],
    type: 'single',
    correctIndex,
  };
}

function attemptFixture(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'attempt-1',
    user: null,
    quiz: {
      id: 'quiz-1',
      title: 'Quiz',
      slug: 'quiz',
    },
    answers: [],
    score: 0,
    totalQuestions: 0,
    takenAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function createService(overrides: ServiceOverrides = {}) {
  const userRepository: Mocked<IUserRepository> = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findPublicProfileById: vi.fn(),
    updateRole: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    countByRole: vi.fn(),
    ...overrides.userRepository,
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
    ...overrides.attemptRepository,
  };
  const quizRepository: Mocked<IQuizRepository> = {
    findById: vi.fn(),
    findBySlug: vi.fn(),
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
    ...overrides.quizRepository,
  };

  return {
    userRepository,
    attemptRepository,
    quizRepository,
    service: new UserService(userRepository, attemptRepository, quizRepository),
  };
}

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPublicProfile', () => {
    it('returns a public DTO without persistence identity fields', async () => {
      const { service, userRepository, quizRepository } = createService();
      userRepository.findPublicProfileById = vi.fn().mockResolvedValue({
        id: '507f191e810c19729de860ea',
        email: 'learner@example.com',
        displayName: 'Learner',
        bio: 'Public bio',
        createdAt: new Date('2026-07-01T00:00:00Z'),
      });
      quizRepository.findPublicByAuthor.mockResolvedValue([
        {
          id: '507f191e810c19729de860eb',
          title: 'Public quiz',
          description: 'Description',
          slug: 'public-quiz',
          author: '507f191e810c19729de860ea',
          questions: [
            {
              id: '507f191e810c19729de860ec',
              question: 'Question',
              options: ['A', 'B'],
              correctIndex: 0,
              type: 'single',
            },
          ],
          isPrivate: false,
          createdAt: new Date('2026-07-02T00:00:00Z'),
          updatedAt: new Date('2026-07-02T00:00:00Z'),
        },
      ]);

      const result = await service.getPublicProfile('507f191e810c19729de860ea');

      assertOk(result);
      expect(result.data).toEqual({
        user: {
          id: '507f191e810c19729de860ea',
          email: 'learner@example.com',
          name: undefined,
          displayName: 'Learner',
          bio: 'Public bio',
          avatar: undefined,
          createdAt: '2026-07-01T00:00:00.000Z',
        },
        quizzes: [
          {
            id: '507f191e810c19729de860eb',
            title: 'Public quiz',
            description: 'Description',
            slug: 'public-quiz',
            createdAt: '2026-07-02T00:00:00.000Z',
            questionCount: 1,
          },
        ],
      });
      expect(result.data.user).not.toHaveProperty('_id');
      expect(result.data.quizzes[0]).not.toHaveProperty('_id');
    });

    it('returns 404 when the public user does not exist', async () => {
      const { service, userRepository, quizRepository } = createService();
      userRepository.findPublicProfileById = vi.fn().mockResolvedValue(null);

      const result = await service.getPublicProfile('missing');

      assertFail(result);
      expect(result.statusCode).toBe(404);
      expect(quizRepository.findPublicByAuthor).not.toHaveBeenCalled();
    });
  });

  describe('getUserAttempts', () => {
    it('returns formatted attempts with pagination', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(userFixture());
      attemptRepository.findByUser.mockResolvedValue({
        items: [
          attemptFixture({
            id: 'attempt-1',
            score: 80,
            totalQuestions: 5,
            takenAt: new Date('2025-01-01'),
            quiz: {
              id: 'quiz-1',
              title: 'Math Quiz',
              slug: 'math-quiz',
              description: 'A math quiz',
              questions: Array.from({ length: 5 }, (_, index) =>
                questionFixture(`question-${index}`),
              ),
            },
          }),
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const result = await service.getUserAttempts('user@test.com', { page: 1, limit: 10 });

      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0]).toMatchObject({
        id: 'attempt-1',
        score: 80,
        quiz: {
          title: 'Math Quiz',
          slug: 'math-quiz',
        },
        totalQuestions: 5,
      });
    });

    it('throws when user is not found', async () => {
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.getUserAttempts('missing@test.com', { page: 1, limit: 10 }),
      ).rejects.toThrow('User not found');
      expect(userRepository.findByEmail).toHaveBeenCalledWith('missing@test.com');
    });

    it('fails fast when repository returns an attempt without populated quiz snapshot', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(userFixture());
      attemptRepository.findByUser.mockResolvedValue({
        items: [
          attemptFixture({
            id: 'attempt-orphaned',
            score: 75,
            takenAt: new Date(),
            totalQuestions: 12,
            quiz: 'quiz-orphaned',
          }),
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      await expect(
        service.getUserAttempts('user@test.com', { page: 1, limit: 10 }),
      ).rejects.toThrow('attempt.quiz is required');
    });

    it('passes pagination options to repository', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(userFixture());
      attemptRepository.findByUser.mockResolvedValue({
        items: [],
        pagination: {
          currentPage: 2,
          totalPages: 5,
          totalItems: 50,
          itemsPerPage: 10,
          hasNextPage: true,
          hasPrevPage: true,
        },
      });

      const result = await service.getUserAttempts('user@test.com', { page: 2, limit: 10 });

      expect(attemptRepository.findByUser).toHaveBeenCalledWith('user-1', {
        page: 2,
        limit: 10,
      });
      expect(result.pagination.currentPage).toBe(2);
    });
  });

  describe('getAttemptDetails', () => {
    it('returns formatted attempt details for authenticated user', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(userFixture());
      attemptRepository.findByIdWithQuiz.mockResolvedValue(
        attemptFixture({
          id: 'attempt-1',
          score: 80,
          takenAt: new Date('2025-01-01'),
          totalQuestions: 2,
          answers: [0, 1],
          quiz: {
            id: 'quiz-1',
            title: 'Math Quiz',
            slug: 'math-quiz',
            description: 'desc',
            questions: [
              {
                id: 'question-1',
                question: 'Q1',
                options: ['A', 'B', 'C'],
                type: 'single',
                correctIndex: 0,
              },
              {
                id: 'question-2',
                question: 'Q2',
                options: ['X', 'Y', 'Z'],
                type: 'single',
                correctIndex: 1,
              },
            ],
          },
        }),
      );

      const result = await service.getAttemptDetails('attempt-1', 'user@test.com');

      assertOk(result);
      expect(result.data.quiz.questions).toHaveLength(2);
      expect(result.data.quiz.questions[0]?.isCorrect).toBe(true);
      expect(result.data.quiz.questions[1]?.isCorrect).toBe(true);
    });

    it('handles anonymous users (no user record)', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(null);
      attemptRepository.findByIdWithQuiz.mockResolvedValue(
        attemptFixture({
          id: 'attempt-1',
          score: 50,
          takenAt: new Date(),
          totalQuestions: 1,
          answers: [0],
          quiz: {
            id: 'quiz-1',
            title: 'Quiz',
            slug: 'quiz',
            questions: [
              {
                id: 'question-1',
                question: 'Q1',
                options: ['A', 'B'],
                type: 'single',
                correctIndex: 0,
              },
            ],
          },
        }),
      );

      const result = await service.getAttemptDetails('attempt-1', 'anon@test.com');

      assertOk(result);
      expect(attemptRepository.findByIdWithQuiz).toHaveBeenCalledWith('attempt-1', {
        guestEmail: 'anon@test.com',
      });
    });

    it('returns 404 when attempt is not found', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(userFixture());
      attemptRepository.findByIdWithQuiz.mockResolvedValue(null);

      const result = await service.getAttemptDetails('missing', 'user@test.com');

      assertFail(result);
      expect(result.error).toBe('Attempt not found');
      expect(result.statusCode).toBe(404);
    });

    it('returns 500 on repository error', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(userFixture());
      attemptRepository.findByIdWithQuiz.mockRejectedValue(new Error('db error'));

      const result = await service.getAttemptDetails('attempt-1', 'user@test.com');

      assertFail(result);
      expect(result.error).toBe('Failed to get attempt details');
      expect(result.statusCode).toBe(500);
    });
  });
});
