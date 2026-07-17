import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  findOne: vi.fn(),
  deleteOne: vi.fn(),
  leanUpdate: vi.fn(),
  leanFind: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/QuizProgress', () => ({
  default: {
    findOneAndUpdate: modelMocks.findOneAndUpdate,
    findOne: modelMocks.findOne,
    deleteOne: modelMocks.deleteOne,
  },
}));

import { QuizProgressRepository } from '@/repositories/QuizProgressRepository';

const userId = '507f191e810c19729de860eb';
const quizId = '507f191e810c19729de860ea';
const invalidId = 'not-an-object-id';

const persistenceRecord = {
  _id: 'progress-1',
  userId,
  quiz: {
    _id: quizId,
    title: 'Architecture',
    slug: 'architecture',
  },
  questionOrder: [0, 1],
  optionOrders: [
    [0, 1],
    [1, 0],
  ],
  userAnswers: [
    { kind: 'single' as const, selectedIndex: 0 },
    { kind: 'multiple' as const, selectedIndexes: [1] },
  ],
  currentQuestionIndex: 1,
  answeredCount: 2,
  totalQuestions: 2,
  updatedAt: new Date('2026-07-16T00:00:00.000Z'),
};

const upsertData = {
  questionOrder: [0, 1],
  optionOrders: [
    [0, 1],
    [1, 0],
  ],
  userAnswers: [0, [1]] as (number | number[])[],
  currentQuestionIndex: 1,
  answeredCount: 2,
  totalQuestions: 2,
};

describe('QuizProgressRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.leanUpdate.mockResolvedValue(persistenceRecord);
    modelMocks.findOneAndUpdate.mockReturnValue({ lean: modelMocks.leanUpdate });
    modelMocks.leanFind.mockResolvedValue(persistenceRecord);
    modelMocks.findOne.mockReturnValue({ lean: modelMocks.leanFind });
    modelMocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
  });

  it('upserts mapped answers with object ids and returns the entity', async () => {
    const repository = new QuizProgressRepository();
    const result = await repository.upsert(userId, quizId, upsertData);

    expect(result).toMatchObject({
      id: 'progress-1',
      userId,
      userAnswers: [0, [1]],
      currentQuestionIndex: 1,
    });
    expect(modelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      {
        userId: expect.objectContaining({ toHexString: expect.any(Function) }),
        quiz: expect.objectContaining({ toHexString: expect.any(Function) }),
      },
      {
        $set: expect.objectContaining({
          questionOrder: [0, 1],
          userAnswers: [
            { kind: 'single', selectedIndex: 0 },
            { kind: 'multiple', selectedIndexes: [1] },
          ],
          updatedAt: expect.any(Date),
        }),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  });

  it('rejects invalid identities on upsert and throws when the write returns null', async () => {
    const repository = new QuizProgressRepository();

    await expect(repository.upsert(invalidId, quizId, upsertData)).rejects.toThrow(
      'Invalid quiz progress identity',
    );
    await expect(repository.upsert(userId, invalidId, upsertData)).rejects.toThrow(
      'Invalid quiz progress identity',
    );
    expect(modelMocks.findOneAndUpdate).not.toHaveBeenCalled();

    modelMocks.leanUpdate.mockResolvedValueOnce(null);
    await expect(repository.upsert(userId, quizId, upsertData)).rejects.toThrow(
      'Failed to upsert quiz progress',
    );
  });

  it('finds progress by user and quiz and returns null for invalid or missing rows', async () => {
    const repository = new QuizProgressRepository();

    await expect(repository.findByUserAndQuiz(userId, quizId)).resolves.toMatchObject({
      id: 'progress-1',
      userAnswers: [0, [1]],
    });
    expect(modelMocks.findOne).toHaveBeenCalledWith({
      userId: expect.objectContaining({ toHexString: expect.any(Function) }),
      quiz: expect.objectContaining({ toHexString: expect.any(Function) }),
    });

    await expect(repository.findByUserAndQuiz(invalidId, quizId)).resolves.toBeNull();
    await expect(repository.findByUserAndQuiz(userId, invalidId)).resolves.toBeNull();

    modelMocks.leanFind.mockResolvedValueOnce(null);
    await expect(repository.findByUserAndQuiz(userId, quizId)).resolves.toBeNull();
  });

  it('deletes by user and quiz and reports whether a document was removed', async () => {
    const repository = new QuizProgressRepository();

    await expect(repository.deleteByUserAndQuiz(userId, quizId)).resolves.toBe(true);
    expect(modelMocks.deleteOne).toHaveBeenCalledWith({
      userId: expect.objectContaining({ toHexString: expect.any(Function) }),
      quiz: expect.objectContaining({ toHexString: expect.any(Function) }),
    });

    modelMocks.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    await expect(repository.deleteByUserAndQuiz(userId, quizId)).resolves.toBe(false);

    await expect(repository.deleteByUserAndQuiz(invalidId, quizId)).resolves.toBe(false);
    await expect(repository.deleteByUserAndQuiz(userId, invalidId)).resolves.toBe(false);
  });
});
