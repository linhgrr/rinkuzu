import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  ledgerCreateMock,
  ledgerFindOneMock,
  startSessionMock,
  userExistsMock,
  walletFindOneAndUpdateMock,
  withTransactionMock,
} = vi.hoisted(() => ({
  ledgerCreateMock: vi.fn(),
  ledgerFindOneMock: vi.fn(),
  startSessionMock: vi.fn(),
  userExistsMock: vi.fn(),
  walletFindOneAndUpdateMock: vi.fn(),
  withTransactionMock: vi.fn(),
}));

vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('mongoose')>();
  return {
    ...actual,
    default: { ...actual.default, startSession: startSessionMock },
  };
});
vi.mock('@/lib/mongoose', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/User', () => ({ default: { exists: userExistsMock } }));
vi.mock('@/models/CreditWallet', () => ({
  default: { findOneAndUpdate: walletFindOneAndUpdateMock },
}));
vi.mock('@/models/CreditLedger', () => ({
  default: { create: ledgerCreateMock, findOne: ledgerFindOneMock },
}));

import { PremiumQuizRepository } from '@/repositories/PremiumQuizRepository';

const USER_ID = '507f191e810c19729de860ee';
const ADMIN_ID = '507f191e810c19729de860eb';
const LEDGER_ID = new Types.ObjectId('507f191e810c19729de860ef');
const IDEMPOTENCY_KEY = '0aa7c561-a366-4abf-81ec-fb90e64c237c';
const FULL_IDEMPOTENCY_KEY = `admin-credit:${ADMIN_ID}:${IDEMPOTENCY_KEY}`;

function leanQuery<T>(value: T) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

describe('PremiumQuizRepository admin credit grant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withTransactionMock.mockImplementation(async (callback: () => Promise<unknown>) => callback());
    startSessionMock.mockResolvedValue({
      withTransaction: withTransactionMock,
      endSession: vi.fn().mockResolvedValue(undefined),
    });
    ledgerFindOneMock.mockReturnValue({
      session: vi.fn().mockReturnValue(leanQuery(null)),
    });
    userExistsMock.mockReturnValue({ session: vi.fn().mockResolvedValue({ _id: USER_ID }) });
    walletFindOneAndUpdateMock.mockReturnValue(leanQuery({ balance: 12 }));
    ledgerCreateMock.mockResolvedValue([{ _id: LEDGER_ID }]);
  });

  it('increments the wallet and writes the immutable admin ledger entry in one transaction', async () => {
    const result = await new PremiumQuizRepository().grantAdminCredits({
      userId: USER_ID,
      adminUserId: ADMIN_ID,
      amount: 5,
      note: 'Verified contribution',
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(walletFindOneAndUpdateMock).toHaveBeenCalledWith(
      { user: new Types.ObjectId(USER_ID) },
      { $inc: { balance: 5 }, $setOnInsert: { user: new Types.ObjectId(USER_ID) } },
      expect.objectContaining({ upsert: true, new: true }),
    );
    expect(ledgerCreateMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user: new Types.ObjectId(USER_ID),
          amount: 5,
          balanceAfter: 12,
          type: 'admin_adjustment',
          referenceType: 'admin',
          referenceId: ADMIN_ID,
          idempotencyKey: FULL_IDEMPOTENCY_KEY,
          note: 'Verified contribution',
        }),
      ],
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(result).toEqual({
      userId: USER_ID,
      amount: 5,
      balance: 12,
      ledgerEntryId: LEDGER_ID.toString(),
      alreadyApplied: false,
    });
    expect(withTransactionMock).toHaveBeenCalledOnce();
  });

  it('returns the prior ledger result without incrementing the wallet on an idempotent replay', async () => {
    const existing = {
      _id: LEDGER_ID,
      user: new Types.ObjectId(USER_ID),
      amount: 5,
      balanceAfter: 12,
      type: 'admin_adjustment' as const,
      referenceType: 'admin' as const,
      referenceId: ADMIN_ID,
      idempotencyKey: FULL_IDEMPOTENCY_KEY,
      note: 'Verified contribution',
      createdAt: new Date(),
    };
    ledgerFindOneMock.mockReturnValue({
      session: vi.fn().mockReturnValue(leanQuery(existing)),
    });

    await expect(
      new PremiumQuizRepository().grantAdminCredits({
        userId: USER_ID,
        adminUserId: ADMIN_ID,
        amount: 5,
        note: 'Verified contribution',
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).resolves.toMatchObject({ balance: 12, alreadyApplied: true });
    expect(walletFindOneAndUpdateMock).not.toHaveBeenCalled();
    expect(ledgerCreateMock).not.toHaveBeenCalled();
  });
});
