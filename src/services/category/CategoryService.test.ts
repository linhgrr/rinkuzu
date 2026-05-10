import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryService } from './CategoryService';

function createService(overrides: Record<string, any> = {}) {
  const categoryRepository = {
    getStatsWithQuizCount: vi.fn(),
    findBySlug: vi.fn(),
    search: vi.fn(),
    ...overrides['categoryRepository'],
  };
  const quizRepository = {
    findAll: vi.fn(),
    ...overrides['quizRepository'],
  };

  return {
    categoryRepository,
    quizRepository,
    service: new CategoryService(categoryRepository, quizRepository),
  };
}

describe('CategoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCategories', () => {
    it('returns transformed categories with slugs and quiz counts', async () => {
      const { service, categoryRepository } = createService();
      categoryRepository.getStatsWithQuizCount.mockResolvedValue([
        {
          _id: 'cat-1',
          name: 'Math',
          description: 'Math quizzes',
          color: '#ff0000',
          quizCount: 5,
          slug: 'math',
          isActive: true,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ]);

      const result = await service.getCategories();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]).toMatchObject({
        _id: 'cat-1',
        name: 'Math',
        slug: 'math',
        quizCount: 5,
      });
    });

    it('generates slug from name when slug is missing', async () => {
      const { service, categoryRepository } = createService();
      categoryRepository.getStatsWithQuizCount.mockResolvedValue([
        {
          _id: 'cat-2',
          name: 'Artificial Intelligence',
          quizCount: 3,
          isActive: true,
        },
      ]);

      const result = await service.getCategories();

      expect(result.data?.[0]?.slug).toBe('artificial-intelligence');
    });

    it('returns error when repository throws', async () => {
      const { service, categoryRepository } = createService();
      categoryRepository.getStatsWithQuizCount.mockRejectedValue(new Error('db error'));

      const result = await service.getCategories();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch categories');
      expect(result.statusCode).toBe(500);
    });
  });

  describe('getCategoryBySlug', () => {
    it('returns category with paginated quizzes', async () => {
      const { service, categoryRepository, quizRepository } = createService();
      categoryRepository.findBySlug.mockResolvedValue({
        _id: 'cat-1',
        name: 'Math',
        isActive: true,
      });
      quizRepository.findAll.mockResolvedValue({
        quizzes: [{ _id: 'quiz-1', title: 'Algebra' }],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 12,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const result = await service.getCategoryBySlug('math');

      expect(result.success).toBe(true);
      expect(result.data?.category._id).toBe('cat-1');
      expect(result.data?.quizzes).toHaveLength(1);
      expect(quizRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'cat-1', status: 'published', isPrivate: false }),
        expect.objectContaining({ page: 1, limit: 12 }),
      );
    });

    it('returns 404 when category is not found', async () => {
      const { service, categoryRepository } = createService();
      categoryRepository.findBySlug.mockResolvedValue(null);

      const result = await service.getCategoryBySlug('missing');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Category not found');
      expect(result.statusCode).toBe(404);
    });

    it('returns 404 when category is inactive', async () => {
      const { service, categoryRepository } = createService();
      categoryRepository.findBySlug.mockResolvedValue({
        _id: 'cat-1',
        name: 'Inactive',
        isActive: false,
      });

      const result = await service.getCategoryBySlug('inactive');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Category is inactive');
      expect(result.statusCode).toBe(404);
    });

    it('returns 500 when category has no _id', async () => {
      const { service, categoryRepository } = createService();
      categoryRepository.findBySlug.mockResolvedValue({
        name: 'No ID',
        isActive: true,
      });

      const result = await service.getCategoryBySlug('no-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Category data is invalid');
      expect(result.statusCode).toBe(500);
    });

    it('passes search filter to quiz repository', async () => {
      const { service, categoryRepository, quizRepository } = createService();
      categoryRepository.findBySlug.mockResolvedValue({
        _id: 'cat-1',
        name: 'Math',
        isActive: true,
      });
      quizRepository.findAll.mockResolvedValue({
        quizzes: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: 12,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      await service.getCategoryBySlug('math', 1, 12, 'algebra');

      expect(quizRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            expect.objectContaining({ title: expect.objectContaining({ $regex: 'algebra' }) }),
          ]),
        }),
        expect.any(Object),
      );
    });

    it('returns error on repository failure', async () => {
      const { service, categoryRepository } = createService();
      categoryRepository.findBySlug.mockRejectedValue(new Error('db down'));

      const result = await service.getCategoryBySlug('math');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get category');
      expect(result.statusCode).toBe(500);
    });
  });

  describe('searchCategories', () => {
    it('searches categories by query', async () => {
      const { service, categoryRepository } = createService();
      categoryRepository.search.mockResolvedValue([{ _id: 'cat-1', name: 'Math' }]);

      const result = await service.searchCategories('math');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(categoryRepository.search).toHaveBeenCalledWith('math');
    });

    it('returns 400 when query is empty', async () => {
      const { service } = createService();

      const result = await service.searchCategories('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search query is required');
      expect(result.statusCode).toBe(400);
    });

    it('trims whitespace from query', async () => {
      const { service, categoryRepository } = createService();
      categoryRepository.search.mockResolvedValue([]);

      await service.searchCategories('  math  ');

      expect(categoryRepository.search).toHaveBeenCalledWith('math');
    });
  });

  describe('getCategoryStats', () => {
    it('returns stats from repository', async () => {
      const { service, categoryRepository } = createService();
      categoryRepository.getStatsWithQuizCount.mockResolvedValue([
        { _id: 'cat-1', name: 'Math', quizCount: 5 },
      ]);

      const result = await service.getCategoryStats();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('returns error on repository failure', async () => {
      const { service, categoryRepository } = createService();
      categoryRepository.getStatsWithQuizCount.mockRejectedValue(new Error('db error'));

      const result = await service.getCategoryStats();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get category stats');
      expect(result.statusCode).toBe(500);
    });
  });
});
