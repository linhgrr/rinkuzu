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

    const [filter, update] = mocks.updateOne.mock.calls[0] as [
      { signupSource: null },
      { $set: { signupSource: { first_seen_at: Date; utm_source: string } } },
    ];
    expect(filter.signupSource).toBeNull();
    expect(update.$set.signupSource.utm_source).toBe('threads');
    expect(update.$set.signupSource.first_seen_at).toEqual(new Date(source.first_seen_at));
  });

  it('recordSignupSourceIfMissing ignores an invalid account id without touching the DB', async () => {
    await new AuthAccountRepository().recordSignupSourceIfMissing('not-an-id', source);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('createPending stores signupSource when given and omits it otherwise', async () => {
    mocks.create.mockResolvedValue({ _id: accountId, email: 'a@example.com', role: 'user' });
    const base = {
      email: 'a@example.com',
      passwordHash: 'hash',
      signupOrigin: { signupLocale: 'en', signupCountry: 'VN' },
      verificationTokenHash: 'tok',
      verificationExpires: new Date('2026-11-17T00:00:00.000Z'),
    } as never;
    const repo = new AuthAccountRepository();

    await repo.createPending({ ...(base as object), signupSource: source } as never);
    await repo.createPending(base);

    const withSource = mocks.create.mock.calls[0]?.[0] as {
      signupSource?: { first_seen_at: Date };
    };
    const without = mocks.create.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(withSource.signupSource?.first_seen_at).toBeInstanceOf(Date);
    expect('signupSource' in without).toBe(false);
  });
});
