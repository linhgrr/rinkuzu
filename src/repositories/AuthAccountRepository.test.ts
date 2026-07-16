import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  select: vi.fn(),
  lean: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/User', () => ({
  default: {
    findOne: mocks.findOne,
    findOneAndUpdate: mocks.findOneAndUpdate,
  },
}));

import { AuthAccountRepository } from '@/repositories/AuthAccountRepository';

describe('AuthAccountRepository token filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lean.mockResolvedValue(null);
    mocks.select.mockReturnValue({ lean: mocks.lean });
    const query = { select: mocks.select };
    mocks.findOne.mockReturnValue(query);
    mocks.findOneAndUpdate.mockReturnValue(query);
  });

  it('matches verification tokens through the partial-index type contract', async () => {
    const now = new Date('2026-07-16T00:00:00.000Z');

    await new AuthAccountRepository().verifyEmail('verification-hash', now);

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerificationTokenHash: { $eq: 'verification-hash', $type: 'string' },
      }),
      expect.any(Object),
      { new: true },
    );
  });

  it('matches password-reset tokens through the partial-index type contract', async () => {
    const now = new Date('2026-07-16T00:00:00.000Z');
    const repository = new AuthAccountRepository();

    await repository.findValidPasswordResetAccount('reset-hash', now);

    expect(mocks.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordResetTokenHash: { $eq: 'reset-hash', $type: 'string' },
      }),
    );
  });

  it('keeps the password-reset type guard in the atomic update', async () => {
    const now = new Date('2026-07-16T00:00:00.000Z');

    await new AuthAccountRepository().resetPassword(
      '507f191e810c19729de860ea',
      'reset-hash',
      'password-hash',
      now,
    );

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordResetTokenHash: { $eq: 'reset-hash', $type: 'string' },
      }),
      expect.any(Object),
      { new: true },
    );
  });
});
