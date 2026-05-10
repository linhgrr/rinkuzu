import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from './UserService';

function createService(overrides: Record<string, any> = {}) {
  const userRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides['userRepository'],
  };
  const attemptRepository = {
    findByUser: vi.fn(),
    findByIdWithQuiz: vi.fn(),
    ...overrides['attemptRepository'],
  };

  return {
    userRepository,
    attemptRepository,
    service: new UserService(userRepository, attemptRepository),
  };
}

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserAttempts', () => {
    it('returns formatted attempts with pagination', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue({
        _id: { toString: () => 'user-1' },
        email: 'user@test.com',
      });
      attemptRepository.findByUser.mockResolvedValue({
        attempts: [
          {
            _id: 'attempt-1',
            score: 80,
            takenAt: new Date('2025-01-01'),
            quiz: {
              _id: 'quiz-1',
              title: 'Math Quiz',
              slug: 'math-quiz',
              description: 'A math quiz',
              questions: [{}, {}, {}, {}, {}],
            },
          },
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

      const result = await service.getUserAttempts('user@test.com');

      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0]).toMatchObject({
        _id: 'attempt-1',
        score: 80,
        quiz: {
          title: 'Math Quiz',
          slug: 'math-quiz',
          totalQuestions: 5,
        },
      });
    });

    it('throws when user is not found', async () => {
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(service.getUserAttempts('missing@test.com')).rejects.toThrow('User not found');
      expect(userRepository.findByEmail).toHaveBeenCalledWith('missing@test.com');
    });

    it('handles missing quiz fields gracefully', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue({
        _id: { toString: () => 'user-1' },
      });
      attemptRepository.findByUser.mockResolvedValue({
        attempts: [
          {
            _id: 'attempt-2',
            score: 100,
            takenAt: new Date(),
            quiz: { _id: 'quiz-2' },
          },
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

      const result = await service.getUserAttempts('user@test.com');

      expect(result.attempts[0].quiz.title).toBe('');
      expect(result.attempts[0].quiz.slug).toBe('');
      expect(result.attempts[0].quiz.totalQuestions).toBe(0);
    });

    it('passes pagination options to repository', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue({
        _id: { toString: () => 'user-1' },
      });
      attemptRepository.findByUser.mockResolvedValue({
        attempts: [],
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
      userRepository.findByEmail.mockResolvedValue({
        _id: { toString: () => 'user-1' },
      });
      attemptRepository.findByIdWithQuiz.mockResolvedValue({
        _id: 'attempt-1',
        score: 80,
        takenAt: new Date('2025-01-01'),
        answers: [0, 1],
        quiz: {
          title: 'Math Quiz',
          slug: 'math-quiz',
          description: 'desc',
          questions: [
            {
              question: 'Q1',
              options: ['A', 'B', 'C'],
              type: 'single',
              correctIndex: 0,
            },
            {
              question: 'Q2',
              options: ['X', 'Y', 'Z'],
              type: 'single',
              correctIndex: 1,
            },
          ],
        },
      });

      const result = await service.getAttemptDetails('attempt-1', 'user@test.com');

      expect(result.success).toBe(true);
      expect(result.data!.quiz.questions).toHaveLength(2);
      expect(result.data!.quiz.questions[0].isCorrect).toBe(true);
      expect(result.data!.quiz.questions[1].isCorrect).toBe(true);
    });

    it('handles anonymous users (no user record)', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue(null);
      attemptRepository.findByIdWithQuiz.mockResolvedValue({
        _id: 'attempt-1',
        score: 50,
        takenAt: new Date(),
        answers: [0],
        quiz: {
          title: 'Quiz',
          slug: 'quiz',
          questions: [
            {
              question: 'Q1',
              options: ['A', 'B'],
              type: 'single',
              correctIndex: 0,
            },
          ],
        },
      });

      const result = await service.getAttemptDetails('attempt-1', 'anon@test.com');

      expect(result.success).toBe(true);
      // Anonymous: email is used as userId
      expect(attemptRepository.findByIdWithQuiz).toHaveBeenCalledWith(
        'attempt-1',
        'anon@test.com',
      );
    });

    it('returns 404 when attempt is not found', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue({
        _id: { toString: () => 'user-1' },
      });
      attemptRepository.findByIdWithQuiz.mockResolvedValue(null);

      const result = await service.getAttemptDetails('missing', 'user@test.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Attempt not found');
      expect(result.statusCode).toBe(404);
    });

    it('returns 500 on repository error', async () => {
      const { service, userRepository, attemptRepository } = createService();
      userRepository.findByEmail.mockResolvedValue({
        _id: { toString: () => 'user-1' },
      });
      attemptRepository.findByIdWithQuiz.mockRejectedValue(new Error('db error'));

      const result = await service.getAttemptDetails('attempt-1', 'user@test.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get attempt details');
      expect(result.statusCode).toBe(500);
    });
  });

  describe('getUserById', () => {
    it('returns user by id', async () => {
      const { service, userRepository } = createService();
      userRepository.findById.mockResolvedValue({ _id: 'user-1', email: 'user@test.com' });

      const result = await service.getUserById('user-1');

      expect(result).toEqual({ _id: 'user-1', email: 'user@test.com' });
      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
    });

    it('returns null when not found', async () => {
      const { service, userRepository } = createService();
      userRepository.findById.mockResolvedValue(null);

      const result = await service.getUserById('missing');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('returns user by email', async () => {
      const { service, userRepository } = createService();
      userRepository.findByEmail.mockResolvedValue({ _id: 'user-1', email: 'a@b.com' });

      const result = await service.getUserByEmail('a@b.com');

      expect(result).toEqual({ _id: 'user-1', email: 'a@b.com' });
    });
  });

  describe('updateUser', () => {
    it('updates and returns user', async () => {
      const { service, userRepository } = createService();
      userRepository.update.mockResolvedValue({ _id: 'user-1', name: 'Updated' });

      const result = await service.updateUser('user-1', { name: 'Updated' });

      expect(result).toEqual({ _id: 'user-1', name: 'Updated' });
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { name: 'Updated' });
    });
  });

  describe('deleteUser', () => {
    it('deletes user and returns true', async () => {
      const { service, userRepository } = createService();
      userRepository.delete.mockResolvedValue(true);

      const result = await service.deleteUser('user-1');

      expect(result).toBe(true);
      expect(userRepository.delete).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getAllUsers', () => {
    it('returns paginated users', async () => {
      const { service, userRepository } = createService();
      userRepository.findAll.mockResolvedValue({
        users: [{ _id: 'user-1', email: 'a@b.com' }],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const result = await service.getAllUsers({ page: 1, limit: 10 });

      expect(result.users).toHaveLength(1);
      expect(userRepository.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });
  });
});
