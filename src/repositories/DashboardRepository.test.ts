import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const quizProgressMocks = vi.hoisted(() => ({
  find: vi.fn(),
  select: vi.fn(),
  sort: vi.fn(),
  limit: vi.fn(),
  populate: vi.fn(),
  lean: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/QuestionProgress', () => ({ default: {} }));
vi.mock('@/models/UserProgress', () => ({ default: {} }));
vi.mock('@/models/QuizProgress', () => ({
  default: { find: quizProgressMocks.find },
}));

import { DashboardRepository } from '@/repositories/DashboardRepository';

describe('DashboardRepository.findInProgressQuizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quizProgressMocks.find.mockReturnValue({ select: quizProgressMocks.select });
    quizProgressMocks.select.mockReturnValue({ sort: quizProgressMocks.sort });
    quizProgressMocks.sort.mockReturnValue({ limit: quizProgressMocks.limit });
    quizProgressMocks.limit.mockReturnValue({ populate: quizProgressMocks.populate });
    quizProgressMocks.populate.mockReturnValue({ lean: quizProgressMocks.lean });
    quizProgressMocks.lean.mockResolvedValue([]);
  });

  it('projects dashboard fields without loading saved answers', async () => {
    const userId = '507f191e810c19729de860ea';
    const repository = new DashboardRepository();

    await expect(repository.findInProgressQuizzes(userId, 6)).resolves.toEqual([]);

    expect(quizProgressMocks.find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
    });
    expect(quizProgressMocks.select).toHaveBeenCalledWith(
      'quiz answeredCount totalQuestions updatedAt',
    );
    expect(quizProgressMocks.sort).toHaveBeenCalledWith({ updatedAt: -1 });
    expect(quizProgressMocks.limit).toHaveBeenCalledWith(6);
    expect(quizProgressMocks.populate).toHaveBeenCalledWith({
      path: 'quiz',
      select: 'title slug',
    });
  });
});
