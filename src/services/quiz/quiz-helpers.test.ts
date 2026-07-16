import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import { checkPrivateQuizAccess, PREMIUM_REQUIRED_CODE } from './quiz-helpers';

const entitlementMocks = vi.hoisted(() => ({
  resolveEntitlements: vi.fn(),
}));

vi.mock('@/lib/entitlements', () => ({
  can: (entitlements: { tier: string }) => entitlements.tier === 'premium',
  resolveEntitlements: entitlementMocks.resolveEntitlements,
}));

function quiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '507f191e810c19729de860ea',
    title: 'Private quiz',
    slug: 'private-quiz',
    author: '507f191e810c19729de860eb',
    questions: [],
    isPrivate: true,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('checkPrivateQuizAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows public quizzes without resolving entitlements', async () => {
    await expect(checkPrivateQuizAccess(quiz({ isPrivate: false }))).resolves.toBeNull();
    expect(entitlementMocks.resolveEntitlements).not.toHaveBeenCalled();
  });

  it('requires authentication before accessing private quiz content', async () => {
    await expect(checkPrivateQuizAccess(quiz())).resolves.toEqual({
      success: false,
      error: 'Authentication required to access private quiz',
      statusCode: 401,
    });
    expect(entitlementMocks.resolveEntitlements).not.toHaveBeenCalled();
  });

  it.each([
    ['author', 'user', '507f191e810c19729de860eb'],
    ['admin', 'admin', '507f191e810c19729de860ec'],
  ])('allows the %s without resolving entitlements', async (_label, role, userId) => {
    await expect(checkPrivateQuizAccess(quiz(), userId, role)).resolves.toBeNull();
    expect(entitlementMocks.resolveEntitlements).not.toHaveBeenCalled();
  });

  it('blocks a free user with the canonical premium error', async () => {
    entitlementMocks.resolveEntitlements.mockResolvedValue({ tier: 'free' });

    await expect(
      checkPrivateQuizAccess(quiz(), '507f191e810c19729de860ec', 'user'),
    ).resolves.toEqual({
      success: false,
      error: 'Premium subscription required to access private quizzes',
      statusCode: 403,
      code: PREMIUM_REQUIRED_CODE,
    });
  });

  it('allows an entitled Premium user', async () => {
    entitlementMocks.resolveEntitlements.mockResolvedValue({ tier: 'premium' });

    await expect(
      checkPrivateQuizAccess(quiz(), '507f191e810c19729de860ec', 'user'),
    ).resolves.toBeNull();
  });
});
