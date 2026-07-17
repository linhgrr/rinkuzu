import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  updateOne: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/User', () => ({
  default: {
    updateOne: mocks.updateOne,
    findOne: mocks.findOne,
    findOneAndUpdate: mocks.findOneAndUpdate,
  },
}));

import { AccountRepository } from '@/repositories/AccountRepository';
import { applySessionUser } from '@/lib/auth/session-projection';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

describe('AccountRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
  });

  describe('updatePasswordHash', () => {
    it('sets password and passwordChangedAt together in one Mongo write', async () => {
      const fixedNow = new Date('2026-07-17T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);

      mocks.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      try {
        const updated = await new AccountRepository().updatePasswordHash(
          'user@example.com',
          'new-password-hash',
        );

        expect(updated).toBe(true);
        expect(mocks.connectDB).toHaveBeenCalledOnce();
        expect(mocks.updateOne).toHaveBeenCalledTimes(1);
        expect(mocks.updateOne).toHaveBeenCalledWith(
          { email: 'user@example.com' },
          {
            $set: {
              password: 'new-password-hash',
              passwordChangedAt: fixedNow,
            },
          },
        );

        const [, updateDoc] = mocks.updateOne.mock.calls[0] as [
          { email: string },
          { $set: { password: string; passwordChangedAt: Date } },
        ];
        expect(updateDoc.$set.passwordChangedAt).toBeInstanceOf(Date);
        expect(updateDoc.$set.passwordChangedAt.getTime()).toBe(fixedNow.getTime());
      } finally {
        vi.useRealTimers();
      }
    });

    it('returns false when no account matches the email filter', async () => {
      mocks.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

      await expect(
        new AccountRepository().updatePasswordHash('missing@example.com', 'hash'),
      ).resolves.toBe(false);

      expect(mocks.updateOne).toHaveBeenCalledWith(
        { email: 'missing@example.com' },
        expect.objectContaining({
          $set: expect.objectContaining({
            password: 'hash',
            passwordChangedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('writes a timestamp that revokes JWTs issued before the password change', async () => {
      const passwordChangedAt = new Date('2026-07-17T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(passwordChangedAt);
      mocks.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      try {
        await new AccountRepository().updatePasswordHash('user@example.com', 'hash');

        const [, updateDoc] = mocks.updateOne.mock.calls[0] as [
          unknown,
          { $set: { passwordChangedAt: Date } },
        ];
        const writtenAt = updateDoc.$set.passwordChangedAt.getTime();
        const olderTokenPwc = writtenAt - 60_000;

        const session: Session = {
          expires: new Date(Date.now() + 60_000).toISOString(),
          user: {
            id: 'user-1',
            email: 'user@example.com',
            role: 'user',
          },
        };
        const token = {
          sub: 'user-1',
          role: 'user',
          pwc: olderTokenPwc,
        } as JWT;

        const revoked = applySessionUser(session, token, {
          id: 'user-1',
          email: 'user@example.com',
          role: 'user',
          passwordChangedAt: writtenAt,
        });
        expect(revoked.user).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
