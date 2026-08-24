import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { countDocumentsMock, createMock, findOneMock } = vi.hoisted(() => ({
  countDocumentsMock: vi.fn(),
  createMock: vi.fn(),
  findOneMock: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/PremiumPlaySession', () => ({
  default: {
    countDocuments: countDocumentsMock,
    create: createMock,
    findOne: findOneMock,
  },
}));

import { PremiumQuizRepository } from '@/repositories/PremiumQuizRepository';

const NOW = new Date('2026-08-24T12:00:00.000Z');
const USER_ID = '507f191e810c19729de860ee';
const QUIZ_ID = '507f191e810c19729de860ea';
const SUBMISSION_ID = '507f191e810c19729de860ec';
const SNAPSHOT_HASH = 'a'.repeat(64);

describe('PremiumQuizRepository session resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies progress from the latest expired session and retains it beyond idle expiry', async () => {
    countDocumentsMock.mockResolvedValue(0);
    const resumable = {
      answers: [{ questionIndex: 1, selectedIndex: 0 }],
      currentQuestionIndex: 1,
      highestBatch: 0,
    };
    const selectMock = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(resumable) });
    const sortMock = vi.fn().mockReturnValue({ select: selectMock });
    findOneMock.mockReturnValue({ sort: sortMock });
    createMock.mockImplementation(async (input) => ({
      toObject: () => ({
        _id: new Types.ObjectId('507f191e810c19729de860ed'),
        ...input,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    }));

    const session = await new PremiumQuizRepository().createSession({
      userId: USER_ID,
      quizId: QUIZ_ID,
      submissionId: SUBMISSION_ID,
      snapshotHash: SNAPSHOT_HASH,
      now: NOW,
    });

    expect(findOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: new Types.ObjectId(USER_ID),
        quiz: new Types.ObjectId(QUIZ_ID),
        submission: new Types.ObjectId(SUBMISSION_ID),
        snapshotHash: SNAPSHOT_HASH,
        completedAt: { $exists: false },
      }),
    );
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: resumable.answers,
        currentQuestionIndex: 1,
        highestBatch: 0,
        purgeAt: new Date('2026-09-23T12:00:00.000Z'),
      }),
    );
    expect(session.answers).toEqual([undefined, 0]);
    expect(session.currentQuestionIndex).toBe(1);
  });

  it('reuses an active session when the two-session limit has been reached', async () => {
    countDocumentsMock.mockResolvedValue(2);
    const activeRecord = {
      _id: new Types.ObjectId('507f191e810c19729de860ed'),
      user: new Types.ObjectId(USER_ID),
      quiz: new Types.ObjectId(QUIZ_ID),
      submission: new Types.ObjectId(SUBMISSION_ID),
      snapshotHash: SNAPSHOT_HASH,
      answers: [],
      currentQuestionIndex: 0,
      highestBatch: 0,
      sessionCode: 'TRACE123',
      idleExpiresAt: new Date('2026-08-24T14:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
      purgeAt: new Date('2026-09-23T12:00:00.000Z'),
      batchWindowStartedAt: NOW,
      batchRequestCount: 0,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const sortMock = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(activeRecord) });
    findOneMock.mockReturnValue({ sort: sortMock });

    const result = await new PremiumQuizRepository().createSession({
      userId: USER_ID,
      quizId: QUIZ_ID,
      submissionId: SUBMISSION_ID,
      snapshotHash: SNAPSHOT_HASH,
      now: NOW,
    });

    expect(result.id).toBe('507f191e810c19729de860ed');
    expect(createMock).not.toHaveBeenCalled();
  });
});
