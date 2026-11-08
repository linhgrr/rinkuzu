import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const starterMocks = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  bulkWrite: vi.fn(),
  deleteOne: vi.fn(),
}));

vi.mock('@/models/StarterQuiz', () => ({ default: starterMocks }));
vi.mock('@/lib/mongoose', () => ({ default: vi.fn().mockResolvedValue(undefined) }));

import { StarterQuizAdminRepository } from '@/repositories/StarterQuizAdminRepository';

const ADMIN_ID = new Types.ObjectId().toString();

describe('StarterQuizAdminRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists rows in order with their ids', async () => {
    const row = { _id: new Types.ObjectId(), quiz: new Types.ObjectId(), locale: 'vi', order: 1 };
    const exec = vi.fn().mockResolvedValue([row]);
    const lean = vi.fn(() => ({ exec }));
    const sort = vi.fn(() => ({ lean }));
    starterMocks.find.mockReturnValue({ sort });

    await expect(new StarterQuizAdminRepository().listStarterQuizRows()).resolves.toEqual([
      { id: row._id.toString(), quizId: row.quiz.toString(), locale: 'vi', order: 1 },
    ]);
    expect(sort).toHaveBeenCalledWith({ order: 1, _id: 1 });
  });

  it('returns null when the unique quiz index rejects a second mark', async () => {
    starterMocks.create.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));

    await expect(
      new StarterQuizAdminRepository().insertStarterQuiz({
        quizId: new Types.ObjectId().toString(),
        locale: 'vi',
        order: 1,
        actorId: ADMIN_ID,
      }),
    ).resolves.toBeNull();
  });

  it('rethrows other insert errors', async () => {
    starterMocks.create.mockRejectedValue(new Error('network'));

    await expect(
      new StarterQuizAdminRepository().insertStarterQuiz({
        quizId: new Types.ObjectId().toString(),
        locale: 'vi',
        order: 1,
        actorId: ADMIN_ID,
      }),
    ).rejects.toThrow('network');
  });

  it('applies row changes in one bulk write and skips the call when there are none', async () => {
    const repository = new StarterQuizAdminRepository();
    const id = new Types.ObjectId().toString();

    await repository.updateStarterQuizRows([], ADMIN_ID);
    expect(starterMocks.bulkWrite).not.toHaveBeenCalled();

    await repository.updateStarterQuizRows([{ id, order: 2 }], ADMIN_ID);
    expect(starterMocks.bulkWrite).toHaveBeenCalledWith(
      [
        {
          updateOne: {
            filter: { _id: new Types.ObjectId(id) },
            update: { $set: { order: 2, updatedBy: new Types.ObjectId(ADMIN_ID) } },
          },
        },
      ],
      { ordered: true },
    );
  });

  it('reports whether a row was deleted', async () => {
    starterMocks.deleteOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    });

    await expect(
      new StarterQuizAdminRepository().deleteStarterQuiz(new Types.ObjectId().toString()),
    ).resolves.toBe(false);
  });
});
