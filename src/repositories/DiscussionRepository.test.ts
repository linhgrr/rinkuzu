import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Discussion } from '@/entities/Discussion';

const discussionModelMocks = vi.hoisted(() => ({
  bulkWrite: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Discussion', () => ({
  default: {
    bulkWrite: discussionModelMocks.bulkWrite,
  },
}));

import { DiscussionRepository } from '@/repositories/DiscussionRepository';

const now = new Date('2026-07-03T10:00:00.000Z');
const quizId = '507f191e810c19729de860ea';

function discussion(questionIndex: number): Discussion {
  return {
    id: `discussion-${questionIndex}`,
    quiz: quizId,
    questionIndex,
    comments: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe('DiscussionRepository.ensureForQuizQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discussionModelMocks.bulkWrite.mockResolvedValue(undefined);
  });

  it('does not write when all quiz question discussions already exist', async () => {
    const repository = new DiscussionRepository();
    vi.spyOn(repository, 'findByQuiz').mockResolvedValue([discussion(0), discussion(1)]);

    const result = await repository.ensureForQuizQuestions(quizId, 2);

    expect(result.map((item) => item.questionIndex)).toEqual([0, 1]);
    expect(discussionModelMocks.bulkWrite).not.toHaveBeenCalled();
  });

  it('upserts only missing discussion indexes and refetches the resolved set', async () => {
    const repository = new DiscussionRepository();
    vi.spyOn(repository, 'findByQuiz')
      .mockResolvedValueOnce([discussion(0)])
      .mockResolvedValueOnce([discussion(0), discussion(1), discussion(2)]);

    const result = await repository.ensureForQuizQuestions(quizId, 3);

    expect(result.map((item) => item.questionIndex)).toEqual([0, 1, 2]);
    expect(discussionModelMocks.bulkWrite).toHaveBeenCalledTimes(1);
    expect(discussionModelMocks.bulkWrite).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: expect.objectContaining({ questionIndex: 1 }),
          }),
        }),
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: expect.objectContaining({ questionIndex: 2 }),
          }),
        }),
      ],
      { ordered: false },
    );
  });
});
