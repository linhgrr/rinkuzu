import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  find: vi.fn(),
  distinct: vi.fn(),
  updateMany: vi.fn(),
  progressUpdateMany: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/lib/logger', () => ({ logger: { warn: mocks.warn } }));
vi.mock('@/models/Attempt', () => ({
  default: { find: mocks.find, distinct: mocks.distinct, updateMany: mocks.updateMany },
}));
vi.mock('@/models/QuestionProgress', () => ({
  default: { updateMany: mocks.progressUpdateMany },
}));

import { GuestDraftAttemptRepository } from '@/repositories/GuestDraftAttemptRepository';

const DRAFT_ID = '6730a0000000000000000001';
const QUIZ = { id: '6730b0000000000000000001', slug: 'fake-biology-quiz' };
const CLAIMER = '6730c0000000000000000001';
const EARLIER_OWNER = '6730c0000000000000000002';

function execs(result: unknown) {
  return { exec: vi.fn().mockResolvedValue(result) };
}

describe('GuestDraftAttemptRepository.moveGuestDraftAttempts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.find.mockReturnValue({
      select: () => ({ lean: () => execs([{ guestClaimTokenHash: 'hash-1' }]) }),
    });
    mocks.distinct.mockReturnValue(
      execs([new Types.ObjectId(EARLIER_OWNER), new Types.ObjectId(CLAIMER)]),
    );
    mocks.updateMany.mockReturnValue(execs({ modifiedCount: 2 }));
    mocks.progressUpdateMany.mockReturnValue(execs({ modifiedCount: 3 }));
  });

  it('re-keys the owners’ review-queue progress from the draft slug to the quiz slug', async () => {
    const repository = new GuestDraftAttemptRepository();

    await expect(repository.moveGuestDraftAttempts(DRAFT_ID, QUIZ, CLAIMER)).resolves.toEqual([
      'hash-1',
    ]);

    expect(mocks.progressUpdateMany).toHaveBeenCalledWith(
      { userId: { $in: [CLAIMER, EARLIER_OWNER] }, quizSlug: `guest-draft-${DRAFT_ID}` },
      { $set: { quizSlug: QUIZ.slug } },
    );
    // Progress first, so a retry that finds no attempt left still re-keys it.
    expect(mocks.progressUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updateMany.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mocks.updateMany).toHaveBeenCalledWith(
      { quiz: new Types.ObjectId(DRAFT_ID) },
      {
        $set: {
          quiz: new Types.ObjectId(QUIZ.id),
          'quizSnapshot.slug': QUIZ.slug,
          fromGuestDraft: true,
        },
      },
      { overwriteImmutable: true },
    );
  });

  it.each([
    [new TypeError('duplicate key'), 'TypeError'],
    ['offline', 'string'],
  ])('still moves the attempts when the progress write fails (%s)', async (failure, errorClass) => {
    mocks.progressUpdateMany.mockReturnValue({ exec: vi.fn().mockRejectedValue(failure) });

    await expect(
      new GuestDraftAttemptRepository().moveGuestDraftAttempts(DRAFT_ID, QUIZ, CLAIMER),
    ).resolves.toEqual(['hash-1']);

    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.warn).toHaveBeenCalledWith(
      { errorClass },
      'Guest draft claimed without moving its review-queue progress',
    );
  });

  it('touches nothing for an invalid draft or quiz id', async () => {
    const repository = new GuestDraftAttemptRepository();

    await expect(repository.moveGuestDraftAttempts('nope', QUIZ, CLAIMER)).resolves.toEqual([]);
    await expect(
      repository.moveGuestDraftAttempts(DRAFT_ID, { id: 'nope', slug: 'x' }, CLAIMER),
    ).resolves.toEqual([]);

    expect(mocks.connectDB).not.toHaveBeenCalled();
    expect(mocks.progressUpdateMany).not.toHaveBeenCalled();
  });
});
