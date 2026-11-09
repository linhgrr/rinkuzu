import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindById: vi.fn(),
  userFind: vi.fn(),
  preferenceFind: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: vi.fn() }));
vi.mock('@/models/Attempt', () => ({ default: {} }));
vi.mock('@/models/User', () => ({
  default: { findById: mocks.userFindById, find: mocks.userFind },
}));
vi.mock('@/models/Communication', () => ({
  EmailOutbox: {},
  FeedbackOutreachPreference: {},
  MarketingConsentEvent: {},
  MarketingContactState: {},
  MarketingPreference: { find: mocks.preferenceFind },
}));
vi.mock('@/repositories/AdminStatsRepository', () => ({ LEARNER_FILTER: {} }));

import { ActivationNudgeRepository } from '@/repositories/ActivationNudgeRepository';

const FIRST = new Types.ObjectId('507f191e810c19729de860e1');
const SECOND = new Types.ObjectId('507f191e810c19729de860e2');
const THIRD = new Types.ObjectId('507f191e810c19729de860e3');
const CREATED = new Date('2026-11-01T00:00:00.000Z');

function fakeUser(id: Types.ObjectId, locale?: string) {
  return {
    _id: id,
    email: `learner-${id.toString().slice(-1)}@example.com`,
    createdAt: CREATED,
    ...(locale ? { locale } : {}),
  };
}

function chain(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    sort: vi.fn(() => query),
    limit: vi.fn(() => query),
    lean: vi.fn().mockResolvedValue(result),
  };
  return query;
}

describe('ActivationNudgeRepository locale (RIN-1263)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers MarketingPreference.locale, then User.locale, then null', async () => {
    const users = [fakeUser(FIRST, 'vi'), fakeUser(SECOND, 'en'), fakeUser(THIRD)];
    const userQuery = chain(users);
    mocks.userFind.mockReturnValue(userQuery);
    mocks.preferenceFind.mockReturnValue(
      chain([
        { userId: FIRST, locale: 'en' },
        { userId: SECOND, locale: null },
      ]),
    );

    const learners = await new ActivationNudgeRepository().learnersSignedUpBetween(
      new Date(0),
      CREATED,
      10,
    );

    expect(learners.map((learner) => learner.locale)).toEqual(['en', 'en', null]);
    expect(userQuery.select).toHaveBeenCalledWith(expect.stringContaining('locale'));
  });

  it('gives a single learner the stored account locale', async () => {
    mocks.userFindById.mockReturnValue(chain(fakeUser(SECOND, 'en')));
    mocks.preferenceFind.mockReturnValue(chain([]));

    const learner = await new ActivationNudgeRepository().findLearner(SECOND);

    expect(learner?.locale).toBe('en');
  });
});
