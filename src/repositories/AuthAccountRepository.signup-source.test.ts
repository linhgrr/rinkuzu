import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/User', () => ({
  default: { create: mocks.create, updateOne: mocks.updateOne },
}));

import { AuthAccountRepository } from '@/repositories/AuthAccountRepository';
import type { CreatePendingAccountData } from '@/interfaces/repositories/IAuthAccountRepository';
import type { FirstTouch } from '@/lib/attribution/first-touch';

const source: FirstTouch = {
  utm_source: 'threads',
  referrer_class: 'social',
  entry_path: '/en/blog',
  first_seen_at: '2026-11-10T08:00:00.000Z',
};
const accountId = '507f191e810c19729de860ea';

describe('AuthAccountRepository signup source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
  });

  it('recordSignupSourceIfMissing matches only accounts without a source and stores a Date', async () => {
    mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
    await new AuthAccountRepository().recordSignupSourceIfMissing(accountId, source);

    expect(mocks.updateOne).toHaveBeenCalledWith(expect.objectContaining({ signupSource: null }), {
      $set: {
        signupSource: expect.objectContaining({
          utm_source: 'threads',
          first_seen_at: new Date(source.first_seen_at),
        }),
      },
    });
  });

  it('recordSignupSourceIfMissing ignores an invalid account id without touching the DB', async () => {
    await new AuthAccountRepository().recordSignupSourceIfMissing('not-an-id', source);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('createPending stores signupSource when given and omits it otherwise', async () => {
    mocks.create.mockResolvedValue({ _id: accountId, email: 'a@example.com', role: 'user' });
    const base: CreatePendingAccountData = {
      email: 'a@example.com',
      passwordHash: 'hash',
      signupOrigin: { signupLocale: 'en', signupCountry: 'VN' },
      verificationTokenHash: 'tok',
      verificationExpires: new Date('2026-11-17T00:00:00.000Z'),
    };
    const repo = new AuthAccountRepository();

    await repo.createPending({ ...base, signupSource: source });
    await repo.createPending(base);

    expect(mocks.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        signupSource: expect.objectContaining({ first_seen_at: new Date(source.first_seen_at) }),
      }),
    );
    expect(mocks.create).toHaveBeenNthCalledWith(
      2,
      expect.not.objectContaining({ signupSource: expect.anything() }),
    );
  });
});
