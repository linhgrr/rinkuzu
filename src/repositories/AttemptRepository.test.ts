import { beforeEach, describe, expect, it, vi } from 'vitest';

const attemptMocks = vi.hoisted(() => ({
  find: vi.fn(),
  select: vi.fn(),
  populate: vi.fn(),
  sort: vi.fn(),
  skip: vi.fn(),
  limit: vi.fn(),
  lean: vi.fn(),
  countDocuments: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Attempt', () => ({
  default: {
    find: attemptMocks.find,
    countDocuments: attemptMocks.countDocuments,
  },
}));

import { AttemptRepository } from '@/repositories/AttemptRepository';

describe('AttemptRepository.findByUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attemptMocks.find.mockReturnValue({ select: attemptMocks.select });
    attemptMocks.select.mockReturnValue({ populate: attemptMocks.populate });
    attemptMocks.populate.mockReturnValue({ sort: attemptMocks.sort });
    attemptMocks.sort.mockReturnValue({ skip: attemptMocks.skip });
    attemptMocks.skip.mockReturnValue({ limit: attemptMocks.limit });
    attemptMocks.limit.mockReturnValue({ lean: attemptMocks.lean });
    attemptMocks.lean.mockResolvedValue([]);
    attemptMocks.countDocuments.mockResolvedValue(0);
  });

  it('projects attempt summaries without loading saved answers', async () => {
    const repository = new AttemptRepository();

    await expect(repository.findByUser('user-1', { page: 2, limit: 10 })).resolves.toMatchObject({
      items: [],
      pagination: {
        currentPage: 2,
        itemsPerPage: 10,
        totalItems: 0,
      },
    });

    expect(attemptMocks.find).toHaveBeenCalledWith({ user: 'user-1' });
    expect(attemptMocks.select).toHaveBeenCalledWith(
      'user guestEmail quiz score totalQuestions takenAt',
    );
    expect(attemptMocks.populate).toHaveBeenCalledWith('quiz', 'title slug description');
    expect(attemptMocks.sort).toHaveBeenCalledWith({ takenAt: -1 });
    expect(attemptMocks.skip).toHaveBeenCalledWith(10);
    expect(attemptMocks.limit).toHaveBeenCalledWith(10);
    expect(attemptMocks.countDocuments).toHaveBeenCalledWith({ user: 'user-1' });
  });
});
