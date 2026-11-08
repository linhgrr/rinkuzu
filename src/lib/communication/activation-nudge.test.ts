import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const HOUR = 3_600_000;
const NOW = new Date('2026-11-06T12:00:00.000Z');
const LEARNER_ID = new Types.ObjectId('6a8ed209f04328ac17443d91');
const ENVIRONMENT: Record<string, string> = {
  AUTH_SECRET: 'test-auth-secret-at-least-32-characters',
  SUPPORT_MAIL_FROM: 'RinKuzu <support@notify.rinkuzu.app>',
};

interface OutboxRow {
  _id: Types.ObjectId;
  dedupeKey: string;
  kind: string;
  userId: Types.ObjectId;
  locale: string;
}

interface OutboxFilter {
  dedupeKey: string;
  kind?: string;
  status?: string;
}

interface OutboxUpdate {
  $setOnInsert?: object;
  $set?: Record<string, unknown>;
}

interface IdFilter {
  userId?: { $in: Types.ObjectId[] };
  _id?: { $ne: Types.ObjectId };
}

const state = vi.hoisted(() => ({
  users: [] as Array<Record<string, unknown>>,
  attempted: [] as unknown[],
  optedOut: [] as unknown[],
  undeliverable: [] as unknown[],
  feedbackOptOut: [] as unknown[],
  rows: new Map<string, unknown>(),
  adaptive: vi.fn(),
  capture: vi.fn(),
}));

const outbox = vi.hoisted(() => ({
  updateOne: vi.fn(async (filter: OutboxFilter, update: OutboxUpdate) => {
    if (update.$set) {
      const row = state.rows.get(filter.dedupeKey) as Record<string, unknown> | undefined;
      const matches =
        row?.['kind'] === filter.kind &&
        row?.['status'] === filter.status &&
        (row?.['clickedAt'] ?? null) === null;
      if (row && matches) Object.assign(row, update.$set);
      return { modifiedCount: row && matches ? 1 : 0 };
    }
    if (state.rows.has(filter.dedupeKey)) return { upsertedCount: 0 };
    state.rows.set(filter.dedupeKey, { _id: new Types.ObjectId(), ...update.$setOnInsert });
    return { upsertedCount: 1 };
  }),
  distinct: vi.fn(async (_field: string, filter: IdFilter) =>
    outboxRows()
      .filter((row) => row.kind === 'activation_nudge')
      .filter((row) => !filter._id || !row._id.equals(filter._id.$ne))
      .map((row) => row.userId),
  ),
}));

/** Thenable stand-in for a chained Mongoose query. */
function query<T>(result: T) {
  const chain = {
    select: () => chain,
    sort: () => chain,
    limit: () => chain,
    lean: () => chain,
    then: (resolve: (value: T) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function outboxRows(): OutboxRow[] {
  return [...state.rows.values()] as OutboxRow[];
}

vi.mock('server-only', () => ({}));
vi.mock('@/lib/mongoose', () => ({ default: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/public-env', () => ({
  publicEnv: { NEXT_PUBLIC_SITE_URL: 'https://www.rinkuzu.app/' },
}));
vi.mock('./resend', () => ({
  communicationEnvironment: (name: string) => {
    const value = ENVIRONMENT[name];
    if (!value) throw new Error(`${name} is required for communications`);
    return value;
  },
}));
vi.mock('@/lib/adaptive/activation-events', () => ({
  fetchAdaptiveActivationEvents: state.adaptive,
}));
vi.mock('@/lib/analytics/server', () => ({ captureServerEvent: state.capture }));
vi.mock('@/models/Quiz', () => ({ default: {} }));
const starters = vi.hoisted(() => ({
  list: vi.fn(),
  candidates: vi.fn(),
}));
vi.mock('@/repositories/DashboardRepository', () => ({
  DashboardRepository: class {
    listStarterQuizEntries = starters.list;
    findStarterQuizCandidates = starters.candidates;
  },
}));
vi.mock('@/models/User', () => ({
  default: {
    find: vi.fn(() => query(state.users)),
    findById: vi.fn((id: Types.ObjectId) =>
      query(state.users.find((user) => (user['_id'] as Types.ObjectId).equals(id)) ?? null),
    ),
  },
}));
vi.mock('@/models/Attempt', () => ({
  default: { distinct: vi.fn(async () => state.attempted) },
}));
vi.mock('@/models/Communication', () => ({
  EmailOutbox: outbox,
  MarketingPreference: { find: vi.fn(() => query([])) },
  MarketingConsentEvent: { distinct: vi.fn(async () => state.optedOut) },
  MarketingContactState: { distinct: vi.fn(async () => state.undeliverable) },
  FeedbackOutreachPreference: { distinct: vi.fn(async () => state.feedbackOptOut) },
}));

import { activationClickToken } from './activation-nudge-policy';
import {
  prepareActivationNudge,
  recordActivationClick,
  recordActivationEmailSent,
  sweepActivationNudges,
} from './activation-nudge';

function learner(overrides: Record<string, unknown> = {}) {
  return {
    _id: LEARNER_ID,
    email: 'learner@gmail.com',
    name: 'Jamie Rivera',
    role: 'user',
    disable: 0,
    isTestAccount: false,
    createdAt: new Date(NOW.getTime() - 30 * HOUR),
    ...overrides,
  };
}

function clickedAt(): unknown {
  const [row] = [...state.rows.values()] as Array<Record<string, unknown>>;
  return row?.['clickedAt'];
}

function theRow(): OutboxRow {
  const [row] = outboxRows();
  if (!row) throw new Error('no row');
  return row;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.users = [learner()];
  state.attempted = [];
  state.optedOut = [];
  state.undeliverable = [];
  state.feedbackOptOut = [];
  state.rows.clear();
  state.adaptive.mockResolvedValue([]);
  state.capture.mockResolvedValue(true);
  delete process.env['ACTIVATION_NUDGE_SENDING_ENABLED'];
});

describe('activation nudge sweep (RIN-999)', () => {
  it('enqueues an eligible learner with trigger 24h, locale vi and availableAt now', async () => {
    await expect(sweepActivationNudges(NOW)).resolves.toEqual({ enqueued: 1, skipped: 0 });
    expect(theRow()).toMatchObject({
      dedupeKey: `activation_nudge:${LEARNER_ID.toString()}`,
      kind: 'activation_nudge',
      entityType: 'user',
      status: 'pending',
      trigger: '24h',
      locale: 'vi',
      availableAt: NOW,
    });
  });

  it.each([
    ['a completed attempt', () => void (state.attempted = [LEARNER_ID])],
    ['an opt-out consent event', () => void (state.optedOut = [LEARNER_ID])],
    ['a bounce or complaint', () => void (state.undeliverable = [LEARNER_ID])],
    ['a feedback opt-out', () => void (state.feedbackOptOut = [LEARNER_ID])],
    [
      'a signup under 24 h ago',
      () => void (state.users = [learner({ createdAt: new Date(NOW.getTime() - HOUR) })]),
    ],
    ['an excluded account', () => void (state.users = [learner({ email: 'qa@example.com' })])],
  ])('skips a learner with %s', async (_label, arrange) => {
    arrange();
    await expect(sweepActivationNudges(NOW)).resolves.toEqual({ enqueued: 0, skipped: 1 });
    expect(state.rows.size).toBe(0);
  });

  it('records a canceled row for an adaptive-only activation and stops asking the API', async () => {
    state.adaptive.mockResolvedValue([
      { userId: LEARNER_ID.toString(), completions: [NOW], succeededUploads: [] },
    ]);

    await expect(sweepActivationNudges(NOW)).resolves.toEqual({ enqueued: 0, skipped: 1 });
    expect(theRow()).toMatchObject({ status: 'canceled', lastError: 'activated' });
    expect(state.adaptive).toHaveBeenCalledTimes(1);

    await expect(sweepActivationNudges(new Date(NOW.getTime() + 2 * 60_000))).resolves.toEqual({
      enqueued: 0,
      skipped: 1,
    });
    expect(state.adaptive).toHaveBeenCalledTimes(1);
    expect(state.rows.size).toBe(1);
  });

  it('enqueues nothing while the kill switch is off', async () => {
    process.env['ACTIVATION_NUDGE_SENDING_ENABLED'] = 'false';
    await expect(sweepActivationNudges(NOW)).resolves.toEqual({ enqueued: 0, skipped: 0 });
    expect(outbox.updateOne).not.toHaveBeenCalled();
  });

  it('is idempotent: two sweeps and a lost insert race leave one row', async () => {
    await sweepActivationNudges(NOW);
    await sweepActivationNudges(new Date(NOW.getTime() + 2 * 60_000));
    expect(state.rows.size).toBe(1);

    outbox.updateOne.mockRejectedValueOnce(Object.assign(new Error('E11000'), { code: 11000 }));
    outbox.distinct.mockResolvedValueOnce([]);
    await expect(sweepActivationNudges(NOW)).resolves.toEqual({ enqueued: 0, skipped: 1 });
    expect(state.rows.size).toBe(1);
  });
});

describe('activation nudge send time (RIN-999)', () => {
  it('renders the email with the unsubscribe headers and the starter-quiz CTA', async () => {
    await sweepActivationNudges(NOW);
    const row = theRow();
    const prepared = await prepareActivationNudge({ ...row, entityId: row.userId }, NOW);

    expect(prepared.decision).toBe('send');
    if (prepared.decision !== 'send') return;
    expect(prepared.mail.subject).toBe('Bài quiz 2 phút của bạn đã sẵn sàng');
    expect(prepared.mail.headers['List-Unsubscribe']).toMatch(
      /^<https:\/\/www\.rinkuzu\.app\/api\/unsubscribe\?t=[^&>]+&c=activation_nudge>$/u,
    );
    expect(prepared.mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    // The CTA is the tracked redirect (RIN-1000), never the quiz URL itself.
    expect(prepared.mail.html).toContain(
      'https://www.rinkuzu.app/api/email/activation-click?t=6a8ed209f04328ac17443d91.',
    );
    expect(prepared.mail.html).toContain('&amp;l=vi');
    expect(prepared.mail.html).toContain('/vi/unsubscribe?t=');
    expect(prepared.mail.html).toContain('c=activation_nudge');
    expect(prepared.mail.tags).toEqual([{ name: 'campaign', value: 'activation_nudge' }]);
  });

  it('cancels when the learner activated after the row was enqueued', async () => {
    await sweepActivationNudges(NOW);
    state.attempted = [LEARNER_ID];
    const row = theRow();

    await expect(prepareActivationNudge({ ...row, entityId: row.userId }, NOW)).resolves.toEqual({
      decision: 'cancel',
      reason: 'activated',
    });
  });

  it('retries later when the adaptive check cannot run, rather than guess', async () => {
    await sweepActivationNudges(NOW);
    state.adaptive.mockRejectedValue(new Error('unavailable'));
    const row = theRow();

    await expect(prepareActivationNudge({ ...row, entityId: row.userId }, NOW)).resolves.toEqual({
      decision: 'retry',
      availableAt: new Date(NOW.getTime() + 30 * 60_000),
    });
  });

  it('cancels a 24h row still retrying after the 7-day look-back', async () => {
    await sweepActivationNudges(NOW);
    const row = theRow();
    const late = new Date(NOW.getTime() + 7 * 24 * HOUR);

    await expect(
      prepareActivationNudge({ ...row, entityId: row.userId, trigger: '24h' }, late),
    ).resolves.toEqual({ decision: 'cancel', reason: 'too_late' });
    expect(state.adaptive).toHaveBeenCalledTimes(1);
  });

  it('emits activation_email_sent with trigger and locale only', async () => {
    await recordActivationEmailSent({ userId: LEARNER_ID, trigger: '24h', locale: 'en' });
    expect(state.capture).toHaveBeenCalledWith('activation_email_sent', LEARNER_ID.toString(), {
      trigger: '24h',
      locale: 'en',
    });
  });
});

describe('activation nudge click (RIN-1000)', () => {
  const STARTER_EN =
    'https://www.rinkuzu.app/en/quiz/how-to-remember-what-you-study-7-question-starter-quiz-093947?entry=activation_email&utm_source=email&utm_campaign=activation_nudge';

  beforeEach(() => {
    starters.list.mockResolvedValue([
      { quizId: 'fake-quiz-vi', locale: 'vi', order: 1 },
      { quizId: 'fake-quiz-en', locale: 'en', order: 2 },
    ]);
    starters.candidates.mockResolvedValue(
      [
        ['fake-quiz-vi', 'cach-ghi-nho-nhung-gi-ban-hoc-quiz-khoi-dong-7-cau-096007'],
        ['fake-quiz-en', 'how-to-remember-what-you-study-7-question-starter-quiz-093947'],
      ].map(([quizId, slug]) => ({
        quizId,
        slug,
        title: 'Fake starter',
        visibility: 'public',
        questionCount: 7,
        isPremium: false,
      })),
    );
  });

  async function sentRow(): Promise<string> {
    await sweepActivationNudges(NOW);
    Object.assign(theRow(), { status: 'completed' });
    return activationClickToken(LEARNER_ID.toString(), ENVIRONMENT['AUTH_SECRET'] ?? '', NOW);
  }

  it('records the first click once, emits activation_email_clicked and lands on the starter', async () => {
    const token = await sentRow();
    const later = new Date(NOW.getTime() + HOUR);

    await expect(recordActivationClick(token, 'en', later)).resolves.toBe(STARTER_EN);
    await expect(
      recordActivationClick(token, 'en', new Date(later.getTime() + HOUR)),
    ).resolves.toBe(STARTER_EN);

    expect(clickedAt()).toEqual(later);
    expect(state.capture).toHaveBeenCalledTimes(1);
    expect(state.capture).toHaveBeenCalledWith('activation_email_clicked', LEARNER_ID.toString(), {
      locale: 'en',
    });
  });

  it('lands on the dashboard when the starter read fails', async () => {
    starters.list.mockRejectedValue(new Error('db down'));

    await expect(recordActivationClick('', 'en', NOW)).resolves.toBe(
      'https://www.rinkuzu.app/en/dashboard?entry=activation_email&utm_source=email&utm_campaign=activation_nudge',
    );
  });

  it('redirects a forged, expired or empty token to the starter and records nothing', async () => {
    const token = await sentRow();
    const expired = new Date(NOW.getTime() + 31 * 24 * HOUR);
    outbox.updateOne.mockClear();

    for (const [value, at] of [
      [`${token.slice(0, -1)}A`, NOW],
      [token, expired],
      ['', NOW],
    ] as const) {
      await expect(recordActivationClick(value, 'en', at)).resolves.toBe(STARTER_EN);
    }
    expect(outbox.updateOne).not.toHaveBeenCalled();
    expect(state.capture).not.toHaveBeenCalled();
    expect(clickedAt()).toBeUndefined();
  });

  it('does not count a click on an account whose nudge was never sent', async () => {
    await sweepActivationNudges(NOW);
    const token = activationClickToken(
      LEARNER_ID.toString(),
      ENVIRONMENT['AUTH_SECRET'] ?? '',
      NOW,
    );

    await expect(recordActivationClick(token, 'vi', NOW)).resolves.toContain(
      '/vi/quiz/cach-ghi-nho-nhung-gi-ban-hoc-quiz-khoi-dong-7-cau-096007?entry=activation_email',
    );
    expect(state.capture).not.toHaveBeenCalled();
  });

  it('still redirects when the database write fails', async () => {
    const token = await sentRow();
    outbox.updateOne.mockRejectedValueOnce(new Error('db down'));

    await expect(recordActivationClick(token, 'en', NOW)).resolves.toBe(STARTER_EN);
    expect(state.capture).not.toHaveBeenCalled();
  });
});
