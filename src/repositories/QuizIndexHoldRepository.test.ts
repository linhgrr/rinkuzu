import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/Quiz', () => ({ default: { updateOne: mocks.updateOne } }));

import { QuizIndexHoldRepository } from '@/repositories/QuizIndexHoldRepository';

const quizId = '507f191e810c19729de860ea';

describe('QuizIndexHoldRepository (RIN-1343)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it('sets a reported hold only when the quiz has none, without touching updatedAt', async () => {
    const since = new Date('2026-11-10T08:00:00Z');

    await new QuizIndexHoldRepository().holdForReport(quizId, since);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(quizId), indexHold: { $exists: false } },
      { $set: { indexHold: { reason: 'reported', since } } },
      { timestamps: false },
    );
  });

  it('removes only a reported hold', async () => {
    await new QuizIndexHoldRepository().releaseReportHold(quizId);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(quizId), 'indexHold.reason': 'reported' },
      { $unset: { indexHold: 1 } },
      { timestamps: false },
    );
  });

  it('ignores an id that is not an ObjectId', async () => {
    await new QuizIndexHoldRepository().holdForReport('not-an-id', new Date());
    await new QuizIndexHoldRepository().releaseReportHold('not-an-id');

    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});
