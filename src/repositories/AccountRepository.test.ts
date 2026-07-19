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
import { ACTIVE_ACCOUNT_FILTER } from '@/shared/constants/account-disable';

function leanChain(result: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(result),
    }),
  };
}

function findOneAndUpdateChain(result: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(result),
    }),
  };
}

const email = 'user@example.com';
const activeEmailFilter = { email, ...ACTIVE_ACCOUNT_FILTER };

describe('AccountRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
  });

  describe('active-state filters on every read/write', () => {
    it('findProfileByEmail filters email + disable:0', async () => {
      mocks.findOne.mockReturnValue(
        leanChain({
          _id: '507f191e810c19729de860ea',
          email,
          role: 'user',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      );

      await new AccountRepository().findProfileByEmail(email);

      expect(mocks.findOne).toHaveBeenCalledWith(activeEmailFilter);
    });

    it('updateProfileByEmail filters email + disable:0', async () => {
      mocks.findOneAndUpdate.mockReturnValue(
        findOneAndUpdateChain({
          _id: '507f191e810c19729de860ea',
          email,
          role: 'user',
          displayName: 'Rin',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      );

      await new AccountRepository().updateProfileByEmail(email, { displayName: 'Rin' });

      expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
        activeEmailFilter,
        { $set: { displayName: 'Rin' } },
        { new: true },
      );
    });

    it('findCredentialsByEmail filters email + disable:0', async () => {
      mocks.findOne.mockReturnValue(
        leanChain({ _id: '507f191e810c19729de860ea', password: 'hash' }),
      );

      await new AccountRepository().findCredentialsByEmail(email);

      expect(mocks.findOne).toHaveBeenCalledWith(activeEmailFilter);
    });

    it('updatePasswordHash filters email + disable:0', async () => {
      mocks.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      await new AccountRepository().updatePasswordHash(email, 'new-hash');

      expect(mocks.updateOne).toHaveBeenCalledWith(
        activeEmailFilter,
        expect.objectContaining({
          $set: expect.objectContaining({ password: 'new-hash' }),
        }),
      );
    });

    it('updateAvatar filters email + disable:0', async () => {
      mocks.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      await new AccountRepository().updateAvatar(email, 'https://cdn.example/a.png');

      expect(mocks.updateOne).toHaveBeenCalledWith(activeEmailFilter, {
        $set: { avatar: 'https://cdn.example/a.png' },
      });
    });

    it('clearAvatar filters email + disable:0', async () => {
      mocks.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      await new AccountRepository().clearAvatar(email);

      expect(mocks.updateOne).toHaveBeenCalledWith(activeEmailFilter, {
        $unset: { avatar: 1 },
      });
    });
  });

  describe('final-write matchedCount-zero after simulated disable', () => {
    it('returns false when password hash update matches no active account', async () => {
      // Simulates disable between credential read and final password write:
      // filter { email, disable: 0 } matches nothing → matchedCount 0.
      mocks.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

      await expect(new AccountRepository().updatePasswordHash(email, 'hash')).resolves.toBe(false);

      expect(mocks.updateOne).toHaveBeenCalledWith(
        activeEmailFilter,
        expect.objectContaining({
          $set: expect.objectContaining({ password: 'hash' }),
        }),
      );
    });

    it('returns false when avatar write races with disable', async () => {
      mocks.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

      await expect(
        new AccountRepository().updateAvatar(email, 'https://cdn.example/a.png'),
      ).resolves.toBe(false);
      await expect(new AccountRepository().clearAvatar(email)).resolves.toBe(false);
    });
  });

  describe('updatePasswordHash', () => {
    it('sets password and passwordChangedAt together in one Mongo write', async () => {
      const fixedNow = new Date('2026-07-17T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);

      mocks.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      try {
        const updated = await new AccountRepository().updatePasswordHash(
          email,
          'new-password-hash',
        );

        expect(updated).toBe(true);
        expect(mocks.connectDB).toHaveBeenCalledOnce();
        expect(mocks.updateOne).toHaveBeenCalledTimes(1);
        expect(mocks.updateOne).toHaveBeenCalledWith(activeEmailFilter, {
          $set: {
            password: 'new-password-hash',
            passwordChangedAt: fixedNow,
          },
        });

        const [, updateDoc] = mocks.updateOne.mock.calls[0] as [
          { email: string; disable: number },
          { $set: { password: string; passwordChangedAt: Date } },
        ];
        expect(updateDoc.$set.passwordChangedAt).toBeInstanceOf(Date);
        expect(updateDoc.$set.passwordChangedAt.getTime()).toBe(fixedNow.getTime());
      } finally {
        vi.useRealTimers();
      }
    });

    it('writes a timestamp that revokes JWTs issued before the password change', async () => {
      const passwordChangedAt = new Date('2026-07-17T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(passwordChangedAt);
      mocks.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      try {
        await new AccountRepository().updatePasswordHash(email, 'hash');

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
            email,
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
          email,
          role: 'user',
          passwordChangedAt: writtenAt,
          authVersion: 0,
        });
        expect(revoked.user).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
