import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '6a8ed209f04328ac17443d91';
const OTHER_USER_ID = '6a8ed209f04328ac17443d92';
const ATTEMPT_ID = '6a8ed20a3d0a1892cacdfe0b';
const QUIZ_ID = '6a8ed20a3d0a1892cacdfe0c';
const OUTBOX_ID = '6a8ed20a3d0a1892cacdfe0a';
const HOUR = 3_600_000;
const TAKEN_AT = new Date('2026-11-02T10:00:00.000Z');
const ENVIRONMENT: Record<string, string> = {
  AUTH_SECRET: 'test-auth-secret-at-least-32-characters',
  SUPPORT_MAIL_FROM: 'RinKuzu <support@notify.rinkuzu.app>',
};

const mocks = vi.hoisted(() => ({
  attempt: { findById: vi.fn(), exists: vi.fn() },
  quiz: { findById: vi.fn() },
  user: { findById: vi.fn() },
  outbox: {
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
  preference: { findOneAndUpdate: vi.fn(), updateOne: vi.fn(), findOne: vi.fn() },
  consentEvent: { create: vi.fn(), exists: vi.fn() },
}));

/** Thenable stand-in for a chained Mongoose query. */
function query<T>(result: T) {
  const chain = {
    select: () => chain,
    lean: () => chain,
    then: (resolve: (value: T) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

const adaptive = vi.hoisted(() => {
  class Unavailable extends Error {}
  return { fetch: vi.fn(), Unavailable };
});

vi.mock('server-only', () => ({}));
vi.mock('@/lib/adaptive/review-facts', () => ({
  fetchAdaptiveReviewFacts: adaptive.fetch,
  AdaptiveReviewFactsUnavailableError: adaptive.Unavailable,
}));
vi.mock('@/lib/mongoose', () => ({ default: vi.fn() }));
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
vi.mock('@/models/Attempt', () => ({ default: mocks.attempt }));
vi.mock('@/models/Quiz', () => ({ default: mocks.quiz }));
vi.mock('@/models/User', () => ({ default: mocks.user }));
vi.mock('@/models/Communication', () => ({
  EmailOutbox: mocks.outbox,
  MarketingPreference: mocks.preference,
  MarketingConsentEvent: mocks.consentEvent,
  AdminActionAudit: { create: vi.fn() },
}));

import {
  optInAdaptiveReviewReminder,
  optInReviewReminder,
  optOutReviewReminder,
  prepareReviewReminder,
  reviewReminderSendingEnabled,
  reviewReminderStatus,
  snoozeReviewReminderPrompt,
  unsubscribeLinkState,
  unsubscribeWithToken,
} from './review-reminder';
import { unsubscribeToken } from './review-reminder-policy';

function attemptDoc(owner = USER_ID) {
  return {
    _id: new Types.ObjectId(ATTEMPT_ID),
    user: new Types.ObjectId(owner),
    quiz: new Types.ObjectId(QUIZ_ID),
    takenAt: TAKEN_AT,
    correctAnswers: 7,
    totalQuestions: 10,
  };
}

function optIn(now = new Date(TAKEN_AT.getTime() + HOUR)) {
  return optInReviewReminder({
    userId: USER_ID,
    email: 'learner@gmail.com',
    attemptId: ATTEMPT_ID,
    locale: 'en',
    ip: '203.0.113.7',
    now,
  });
}

describe('review reminder consent (AC3/AC4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.attempt.findById.mockReturnValue(query(attemptDoc()));
    mocks.preference.findOneAndUpdate.mockReturnValue(query(null));
    mocks.preference.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.outbox.updateOne.mockResolvedValue({ upsertedCount: 1 });
    mocks.outbox.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  it('records the opt-in with result_page_review, then schedules one email 48 h out', async () => {
    const result = await optIn();

    expect(result).toEqual({
      optedIn: true,
      status: 'scheduled',
      scheduledFor: new Date(TAKEN_AT.getTime() + 48 * HOUR).toISOString(),
    });
    expect(mocks.preference.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: new Types.ObjectId(USER_ID) },
      { $set: { studyReminders: true, locale: 'en' } },
      expect.objectContaining({ upsert: true }),
    );
    expect(mocks.preference.updateOne).toHaveBeenCalledWith(
      { userId: new Types.ObjectId(USER_ID) },
      { $set: { studyRemindersOptedInAt: expect.any(Date) } },
    );
    expect(mocks.consentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'study_reminders',
        action: 'opt_in',
        source: 'result_page_review',
        ipHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    );
    const [filter, update, options] = mocks.outbox.updateOne.mock.calls[0] ?? [];
    expect(filter).toMatchObject({ status: { $in: ['pending', 'canceled'] } });
    expect(filter.dedupeKey).toMatch(new RegExp(`^review_reminder/${USER_ID}/\\d+$`, 'u'));
    expect(update.$set).toMatchObject({
      kind: 'review_reminder',
      entityType: 'attempt',
      status: 'pending',
      availableAt: new Date(TAKEN_AT.getTime() + 48 * HOUR),
    });
    expect(options).toEqual({ upsert: true });
    // The final day-5 touch is scheduled with it, keyed in the same bucket (RIN-1304).
    const [d5Filter, d5Update] = mocks.outbox.updateOne.mock.calls[1] ?? [];
    expect(d5Filter.dedupeKey).toBe(
      filter.dedupeKey.replace('review_reminder/', 'review_reminder_d5/'),
    );
    expect(d5Update.$set).toMatchObject({
      kind: 'review_reminder_d5',
      entityType: 'attempt',
      status: 'pending',
      availableAt: new Date(TAKEN_AT.getTime() + 120 * HOUR),
    });
    // Consent comes first: the outbox write follows the event.
    expect(mocks.consentEvent.create.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.outbox.updateOne.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('is idempotent: a repeated opt-in writes no second consent event', async () => {
    mocks.preference.findOneAndUpdate.mockReturnValue(query({ studyReminders: true }));

    await optIn();

    expect(mocks.consentEvent.create).not.toHaveBeenCalled();
    expect(mocks.preference.updateOne).not.toHaveBeenCalled();
    expect(mocks.outbox.updateOne).toHaveBeenCalledTimes(2);
  });

  it("refuses someone else's attempt and enqueues nothing", async () => {
    mocks.attempt.findById.mockReturnValue(query(attemptDoc(OTHER_USER_ID)));

    await expect(optIn()).rejects.toMatchObject({ code: 'not_found', status: 404 });
    expect(mocks.preference.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.consentEvent.create).not.toHaveBeenCalled();
    expect(mocks.outbox.updateOne).not.toHaveBeenCalled();
  });

  it('refuses an opt-in too late to send on time, before writing anything', async () => {
    await expect(optIn(new Date(TAKEN_AT.getTime() + 47 * HOUR))).rejects.toMatchObject({
      code: 'attempt_too_old',
      status: 409,
    });
    expect(mocks.consentEvent.create).not.toHaveBeenCalled();
    expect(mocks.outbox.updateOne).not.toHaveBeenCalled();
  });

  it('reports the d5 time when d2 is already taken in the bucket but d5 is free', async () => {
    mocks.outbox.updateOne
      .mockRejectedValueOnce(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }))
      .mockResolvedValueOnce({ upsertedCount: 1 });
    mocks.outbox.findOne.mockReturnValue(query({ status: 'completed', availableAt: new Date() }));

    await expect(optIn()).resolves.toEqual({
      optedIn: true,
      status: 'scheduled',
      scheduledFor: new Date(TAKEN_AT.getTime() + 120 * HOUR).toISOString(),
    });
  });

  it('reports the weekly cap when the bucket already holds both sent emails', async () => {
    mocks.outbox.updateOne.mockRejectedValue(
      Object.assign(new Error('E11000 duplicate key'), { code: 11000 }),
    );
    mocks.outbox.findOne.mockReturnValue(query({ status: 'completed', availableAt: new Date() }));

    await expect(optIn()).resolves.toEqual({ optedIn: true, status: 'capped', scheduledFor: null });
  });

  it('un-ticking records an opt-out and cancels pending emails', async () => {
    mocks.preference.findOneAndUpdate.mockReturnValue(query({ studyReminders: true }));

    await expect(
      optOutReviewReminder({ userId: USER_ID, source: 'result_page_review', ip: null }),
    ).resolves.toEqual({ optedIn: false });

    expect(mocks.consentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'study_reminders',
        action: 'opt_out',
        source: 'result_page_review',
      }),
    );
    expect(mocks.outbox.updateMany).toHaveBeenCalledWith(
      {
        userId: new Types.ObjectId(USER_ID),
        kind: { $in: ['review_reminder', 'review_reminder_d5'] },
        status: 'pending',
      },
      { $set: { status: 'canceled', lastError: 'opted_out' } },
    );
  });
});

describe('review reminder prompt status and snooze (RIN-1362)', () => {
  const DAY = 24 * HOUR;

  function status(now: Date, attemptId: string | null = ATTEMPT_ID) {
    return reviewReminderStatus({ userId: USER_ID, email: 'learner@gmail.com', attemptId, now });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.attempt.findById.mockReturnValue(query(attemptDoc()));
    mocks.attempt.exists.mockResolvedValue(null);
    mocks.preference.findOne.mockReturnValue(query(null));
    mocks.preference.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it('offers the prompt for a fresh attempt with missed questions', async () => {
    await expect(status(new Date(TAKEN_AT.getTime() + HOUR))).resolves.toEqual({
      optedIn: false,
      snoozedUntil: null,
      eligible: true,
    });
  });

  it('checks the latest-attempt rule the sender uses and offers the prompt on the latest one', async () => {
    await expect(status(new Date(TAKEN_AT.getTime() + HOUR))).resolves.toMatchObject({
      eligible: true,
    });
    expect(mocks.attempt.exists).toHaveBeenCalledWith({
      user: new Types.ObjectId(USER_ID),
      takenAt: { $gt: TAKEN_AT },
    });
  });

  it('is not eligible for an older attempt once a later one exists (the email would be canceled)', async () => {
    mocks.attempt.exists.mockResolvedValue({ _id: new Types.ObjectId() });
    mocks.preference.findOne.mockReturnValue(query({ studyReminders: true }));
    await expect(status(new Date(TAKEN_AT.getTime() + HOUR))).resolves.toEqual({
      optedIn: true,
      snoozedUntil: null,
      eligible: false,
    });
  });

  it('reports an existing opt-in', async () => {
    mocks.preference.findOne.mockReturnValue(query({ studyReminders: true }));
    await expect(status(new Date(TAKEN_AT.getTime() + HOUR))).resolves.toMatchObject({
      optedIn: true,
      eligible: true,
    });
  });

  it.each([
    ['too old (47 h)', () => attemptDoc(), 47 * HOUR],
    ['zero missed', () => ({ ...attemptDoc(), correctAnswers: 10 }), HOUR],
    ["someone else's", () => attemptDoc(OTHER_USER_ID), HOUR],
  ])('is not eligible for an attempt that is %s', async (_label, doc, age) => {
    mocks.attempt.findById.mockReturnValue(query(doc()));
    await expect(status(new Date(TAKEN_AT.getTime() + age))).resolves.toMatchObject({
      eligible: false,
    });
  });

  it('is not eligible without an attempt id', async () => {
    await expect(status(new Date(TAKEN_AT.getTime() + HOUR), null)).resolves.toMatchObject({
      eligible: false,
    });
    expect(mocks.attempt.findById).not.toHaveBeenCalled();
  });

  it('"No thanks" hides the prompt until +7 d and records no consent event', async () => {
    const snoozedAt = new Date(TAKEN_AT.getTime() + HOUR);
    const result = await snoozeReviewReminderPrompt({ userId: USER_ID, now: snoozedAt });

    const until = new Date(snoozedAt.getTime() + 7 * DAY);
    expect(result).toEqual({ snoozedUntil: until.toISOString() });
    expect(mocks.preference.updateOne).toHaveBeenCalledWith(
      { userId: new Types.ObjectId(USER_ID) },
      { $set: { reviewPromptSnoozedUntil: until } },
      { upsert: true },
    );
    expect(mocks.consentEvent.create).not.toHaveBeenCalled();
    expect(mocks.preference.findOneAndUpdate).not.toHaveBeenCalled();

    mocks.preference.findOne.mockReturnValue(query({ reviewPromptSnoozedUntil: until }));
    await expect(
      status(new Date(snoozedAt.getTime() + 6 * DAY + 23 * HOUR)),
    ).resolves.toMatchObject({ snoozedUntil: until.toISOString() });
    await expect(status(new Date(snoozedAt.getTime() + 7 * DAY))).resolves.toMatchObject({
      snoozedUntil: null,
    });
  });
});

describe('review reminder send-time preparation (AC5)', () => {
  const item = {
    _id: new Types.ObjectId(OUTBOX_ID),
    kind: 'review_reminder',
    entityId: new Types.ObjectId(ATTEMPT_ID),
    userId: new Types.ObjectId(USER_ID),
    availableAt: new Date(TAKEN_AT.getTime() + 48 * HOUR),
  };
  const due = new Date(TAKEN_AT.getTime() + 48 * HOUR);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.attempt.findById.mockReturnValue(query(attemptDoc()));
    mocks.attempt.exists.mockResolvedValue(null);
    mocks.outbox.countDocuments.mockResolvedValue(0);
    mocks.user.findById.mockReturnValue(
      query({ email: 'learner@gmail.com', role: 'user', disable: 0, isTestAccount: false }),
    );
    mocks.preference.findOne.mockReturnValue(query({ studyReminders: true, locale: 'en' }));
    mocks.quiz.findById.mockReturnValue(query({ slug: 'cell-biology', title: 'Cell biology' }));
    adaptive.fetch.mockResolvedValue({ latestCompletion: null, completionsAfter: [] });
  });

  it('renders a tagged email with RFC 8058 headers and no answers', async () => {
    const prepared = await prepareReviewReminder(item, due);

    expect(prepared.decision).toBe('send');
    if (prepared.decision !== 'send') return;
    expect(prepared.mail.tags).toEqual([{ name: 'campaign', value: 'w1-review' }]);
    expect(prepared.mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const token = unsubscribeToken(USER_ID, ENVIRONMENT['AUTH_SECRET'] ?? '');
    expect(prepared.mail.headers['List-Unsubscribe']).toBe(
      `<https://www.rinkuzu.app/api/unsubscribe?t=${token}>`,
    );
    expect(prepared.mail.text).toContain(`https://www.rinkuzu.app/en/unsubscribe?t=${token}`);
    expect(prepared.mail.subject).toBe('Review the 3 questions you missed in “Cell biology”');
    expect(prepared.mail.text).toContain(
      `https://www.rinkuzu.app/en/quiz/cell-biology?retryOf=${ATTEMPT_ID}&utm_source=email&utm_campaign=w1-review`,
    );
  });

  it('falls back to the account locale when the preference has none (RIN-1263)', async () => {
    mocks.preference.findOne.mockReturnValue(query({ studyReminders: true, locale: null }));
    mocks.user.findById.mockReturnValue(
      query({
        email: 'learner@gmail.com',
        role: 'user',
        disable: 0,
        isTestAccount: false,
        locale: 'en',
      }),
    );

    const prepared = await prepareReviewReminder(item, due);

    expect(prepared.decision).toBe('send');
    if (prepared.decision !== 'send') return;
    expect(prepared.mail.text).toContain('https://www.rinkuzu.app/en/quiz/cell-biology');
  });

  it('cancels when the account no longer exists', async () => {
    mocks.preference.findOne.mockReturnValue(query({ studyReminders: true, locale: null }));
    mocks.user.findById.mockReturnValue(query(null));

    const prepared = await prepareReviewReminder(item, due);

    expect(prepared.decision).toBe('cancel');
  });

  it('keeps the opt-in page locale over the account locale', async () => {
    mocks.preference.findOne.mockReturnValue(query({ studyReminders: true, locale: 'vi' }));
    mocks.user.findById.mockReturnValue(
      query({
        email: 'learner@gmail.com',
        role: 'user',
        disable: 0,
        isTestAccount: false,
        locale: 'en',
      }),
    );

    const prepared = await prepareReviewReminder(item, due);

    expect(prepared.decision).toBe('send');
    if (prepared.decision !== 'send') return;
    expect(prepared.mail.text).toContain('https://www.rinkuzu.app/vi/quiz/cell-biology');
  });

  it('cancels after a later attempt by the same learner', async () => {
    mocks.attempt.exists.mockResolvedValue({ _id: new Types.ObjectId() });

    await expect(prepareReviewReminder(item, due)).resolves.toEqual({
      decision: 'cancel',
      reason: 'later_attempt',
    });
    expect(mocks.attempt.exists).toHaveBeenCalledWith({
      user: new Types.ObjectId(USER_ID),
      takenAt: { $gt: TAKEN_AT },
    });
  });

  it('cancels a third review email in 7 days, counting both touches (RIN-1304)', async () => {
    mocks.outbox.countDocuments.mockResolvedValue(2);

    await expect(prepareReviewReminder(item, due)).resolves.toEqual({
      decision: 'cancel',
      reason: 'weekly_cap',
    });
    expect(mocks.outbox.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: { $in: ['review_reminder', 'review_reminder_d5'] },
        status: 'completed',
        updatedAt: { $gte: new Date(due.getTime() - 7 * 24 * HOUR) },
      }),
      { limit: 2 },
    );
  });

  it('sends a second review email in 7 days', async () => {
    mocks.outbox.countDocuments.mockResolvedValue(1);

    await expect(prepareReviewReminder(item, due)).resolves.toMatchObject({ decision: 'send' });
  });

  it('sends the d5 touch with its own campaign, copy and retry link', async () => {
    const d5 = new Date(TAKEN_AT.getTime() + 120 * HOUR);
    const prepared = await prepareReviewReminder(
      { ...item, kind: 'review_reminder_d5', availableAt: d5 },
      d5,
    );

    expect(prepared.decision).toBe('send');
    if (prepared.decision !== 'send') return;
    expect(prepared.mail.tags).toEqual([{ name: 'campaign', value: 'w1-review-d5' }]);
    expect(prepared.mail.subject).toBe('3 questions in “Cell biology” are due for review');
    expect(prepared.mail.text).toContain(
      `https://www.rinkuzu.app/en/quiz/cell-biology?retryOf=${ATTEMPT_ID}&utm_source=email&utm_campaign=w1-review-d5`,
    );
    expect(prepared.mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('cancels d5 after a new attempt at 60 h, and too late after 122 h', async () => {
    const d5 = new Date(TAKEN_AT.getTime() + 120 * HOUR);
    const d5Item = { ...item, kind: 'review_reminder_d5', availableAt: d5 };
    mocks.attempt.exists.mockResolvedValue({ _id: new Types.ObjectId() });
    await expect(prepareReviewReminder(d5Item, d5)).resolves.toEqual({
      decision: 'cancel',
      reason: 'later_attempt',
    });
    await expect(
      prepareReviewReminder(d5Item, new Date(d5.getTime() + 2 * HOUR + 1)),
    ).resolves.toEqual({ decision: 'cancel', reason: 'too_late' });
  });

  it('cancels after an opt-out', async () => {
    mocks.preference.findOne.mockReturnValue(query({ studyReminders: false }));

    await expect(prepareReviewReminder(item, due)).resolves.toEqual({
      decision: 'cancel',
      reason: 'opted_out',
    });
  });
});

describe('Path B: adaptive end-screen review emails (RIN-1364)', () => {
  const COMPLETED_AT = new Date('2026-11-03T08:00:00.000Z');
  const completion = {
    completedAt: COMPLETED_AT,
    documentId: 'session-1',
    documentTitle: 'Biology notes.pdf',
    dueCount: 2,
  };
  const due = new Date(COMPLETED_AT.getTime() + 48 * HOUR);
  const pathBItem = {
    _id: new Types.ObjectId(OUTBOX_ID),
    kind: 'review_reminder',
    entityType: 'adaptive_completion',
    entityId: new Types.ObjectId(USER_ID),
    availableAt: due,
    dueAt: due,
    anchorAt: COMPLETED_AT,
    anchorDocumentId: 'session-1',
  };

  function optInB(now = new Date(COMPLETED_AT.getTime() + HOUR)) {
    return optInAdaptiveReviewReminder({
      userId: USER_ID,
      email: 'learner@gmail.com',
      locale: 'en',
      ip: '203.0.113.7',
      now,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    adaptive.fetch.mockResolvedValue({ latestCompletion: completion, completionsAfter: [] });
    mocks.attempt.findById.mockReturnValue(query(attemptDoc()));
    mocks.attempt.exists.mockResolvedValue(null);
    mocks.preference.findOneAndUpdate.mockReturnValue(query(null));
    mocks.preference.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.preference.findOne.mockReturnValue(query({ studyReminders: true, locale: 'en' }));
    mocks.outbox.updateOne.mockResolvedValue({ upsertedCount: 1 });
    mocks.outbox.countDocuments.mockResolvedValue(0);
    mocks.user.findById.mockReturnValue(
      query({ email: 'learner@gmail.com', role: 'user', disable: 0, isTestAccount: false }),
    );
    mocks.quiz.findById.mockReturnValue(query({ slug: 'cell-biology', title: 'Cell biology' }));
  });

  it('opt-in schedules d2 + d5 from the latest completion, anchored on the row', async () => {
    await expect(optInB()).resolves.toEqual({
      optedIn: true,
      status: 'scheduled',
      scheduledFor: due.toISOString(),
    });

    expect(adaptive.fetch).toHaveBeenCalledWith(USER_ID, undefined);
    expect(mocks.consentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'opt_in', source: 'adaptive_end_review' }),
    );
    const [filter, update] = mocks.outbox.updateOne.mock.calls[0] ?? [];
    // The same bucket keys as Path A: one learner never holds two pairs in a bucket.
    expect(filter.dedupeKey).toMatch(new RegExp(`^review_reminder/${USER_ID}/\\d+$`, 'u'));
    expect(update.$set).toMatchObject({
      kind: 'review_reminder',
      entityType: 'adaptive_completion',
      entityId: new Types.ObjectId(USER_ID),
      anchorAt: COMPLETED_AT,
      anchorDocumentId: 'session-1',
      availableAt: due,
      dueAt: due,
    });
    const [, d5Update] = mocks.outbox.updateOne.mock.calls[1] ?? [];
    expect(d5Update.$set).toMatchObject({
      kind: 'review_reminder_d5',
      entityType: 'adaptive_completion',
      availableAt: new Date(COMPLETED_AT.getTime() + 120 * HOUR),
    });
  });

  it('a Path A opt-in in the same bucket re-points the rows and clears the anchor', async () => {
    await optInReviewReminder({
      userId: USER_ID,
      email: 'learner@gmail.com',
      attemptId: ATTEMPT_ID,
      locale: 'en',
      ip: null,
      now: new Date(TAKEN_AT.getTime() + HOUR),
    });

    const [, update] = mocks.outbox.updateOne.mock.calls[0] ?? [];
    expect(update.$set).toMatchObject({
      entityType: 'attempt',
      entityId: new Types.ObjectId(ATTEMPT_ID),
      anchorAt: null,
      anchorDocumentId: null,
    });
  });

  it.each([
    ['older than 46 h', () => undefined, 47 * HOUR],
    [
      'followed by a quiz attempt',
      () => mocks.attempt.exists.mockResolvedValue({ _id: new Types.ObjectId() }),
      HOUR,
    ],
    [
      'missing',
      () => adaptive.fetch.mockResolvedValue({ latestCompletion: null, completionsAfter: [] }),
      HOUR,
    ],
  ])('refuses a completion %s with no consent recorded', async (_label, arrange, age) => {
    arrange();

    await expect(optInB(new Date(COMPLETED_AT.getTime() + age))).rejects.toMatchObject({
      code: 'completion_too_old',
      status: 409,
    });
    expect(mocks.preference.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.consentEvent.create).not.toHaveBeenCalled();
    expect(mocks.outbox.updateOne).not.toHaveBeenCalled();
  });

  it('answers 503 and writes nothing when the API is unavailable at opt-in', async () => {
    adaptive.fetch.mockRejectedValue(new adaptive.Unavailable('status 504'));

    await expect(optInB()).rejects.toMatchObject({ code: 'adaptive_unavailable', status: 503 });
    expect(mocks.consentEvent.create).not.toHaveBeenCalled();
    expect(mocks.outbox.updateOne).not.toHaveBeenCalled();
  });

  it('the prompt status is eligible on a fresh completion and not when the API is down', async () => {
    const status = () =>
      reviewReminderStatus({
        userId: USER_ID,
        email: 'learner@gmail.com',
        path: 'adaptive',
        now: new Date(COMPLETED_AT.getTime() + HOUR),
      });
    mocks.preference.findOne.mockReturnValue(query(null));

    await expect(status()).resolves.toEqual({ optedIn: false, snoozedUntil: null, eligible: true });
    adaptive.fetch.mockRejectedValue(new adaptive.Unavailable('status 504'));
    await expect(status()).resolves.toMatchObject({ eligible: false });
    expect(mocks.attempt.findById).not.toHaveBeenCalled();
  });

  it('sends the document title, due count and adaptive link, asking the API after the anchor', async () => {
    const prepared = await prepareReviewReminder(pathBItem, due);

    expect(adaptive.fetch).toHaveBeenCalledWith(USER_ID, COMPLETED_AT);
    expect(mocks.attempt.findById).not.toHaveBeenCalled();
    expect(mocks.attempt.exists).toHaveBeenCalledWith({
      user: new Types.ObjectId(USER_ID),
      takenAt: { $gt: COMPLETED_AT },
    });
    expect(prepared.decision).toBe('send');
    if (prepared.decision !== 'send') return;
    expect(prepared.mail.tags).toEqual([{ name: 'campaign', value: 'w1-review' }]);
    expect(prepared.mail.subject).toBe('Review the 2 concepts to firm up in “Biology notes.pdf”');
    expect(prepared.mail.text).toContain(
      'https://www.rinkuzu.app/en/adaptive/subject/session-1?utm_source=email&utm_campaign=w1-review',
    );
    expect(prepared.mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('sends d5 with its campaign and falls back to the dashboard without a session', async () => {
    const d5 = new Date(COMPLETED_AT.getTime() + 120 * HOUR);
    adaptive.fetch.mockResolvedValue({
      latestCompletion: { ...completion, documentId: null, documentTitle: null },
      completionsAfter: [],
    });

    const prepared = await prepareReviewReminder(
      {
        ...pathBItem,
        kind: 'review_reminder_d5',
        availableAt: d5,
        dueAt: d5,
        anchorDocumentId: null,
      },
      d5,
    );

    expect(prepared.decision).toBe('send');
    if (prepared.decision !== 'send') return;
    expect(prepared.mail.tags).toEqual([{ name: 'campaign', value: 'w1-review-d5' }]);
    expect(prepared.mail.subject).toBe('2 concepts in “your document” are due for review');
    expect(prepared.mail.text).toContain(
      'https://www.rinkuzu.app/en/adaptive?utm_source=email&utm_campaign=w1-review-d5',
    );
  });

  it('a later adaptive completion cancels a pending Path B row', async () => {
    adaptive.fetch.mockResolvedValue({
      latestCompletion: completion,
      completionsAfter: [new Date(COMPLETED_AT.getTime() + 5 * HOUR)],
    });

    await expect(prepareReviewReminder(pathBItem, due)).resolves.toEqual({
      decision: 'cancel',
      reason: 'later_completion',
    });
  });

  it('a later quiz attempt cancels a Path B row', async () => {
    mocks.attempt.exists.mockResolvedValue({ _id: new Types.ObjectId() });

    await expect(prepareReviewReminder(pathBItem, due)).resolves.toEqual({
      decision: 'cancel',
      reason: 'later_attempt',
    });
  });

  it('a later adaptive completion cancels a Path A row', async () => {
    adaptive.fetch.mockResolvedValue({
      latestCompletion: completion,
      completionsAfter: [new Date(TAKEN_AT.getTime() + HOUR)],
    });
    const pathAItem = {
      _id: new Types.ObjectId(OUTBOX_ID),
      kind: 'review_reminder',
      entityId: new Types.ObjectId(ATTEMPT_ID),
      availableAt: new Date(TAKEN_AT.getTime() + 48 * HOUR),
    };

    await expect(prepareReviewReminder(pathAItem, pathAItem.availableAt)).resolves.toEqual({
      decision: 'cancel',
      reason: 'later_completion',
    });
    expect(adaptive.fetch).toHaveBeenCalledWith(USER_ID, TAKEN_AT);
  });

  it('cancels when the API no longer reports the completion', async () => {
    adaptive.fetch.mockResolvedValue({ latestCompletion: null, completionsAfter: [] });

    await expect(prepareReviewReminder(pathBItem, due)).resolves.toEqual({
      decision: 'cancel',
      reason: 'completion_missing',
    });
  });

  it('API down at send time: retries in 10 min inside the window, then too_late', async () => {
    adaptive.fetch.mockRejectedValue(new adaptive.Unavailable('status 504'));

    await expect(prepareReviewReminder(pathBItem, due)).resolves.toEqual({
      decision: 'retry',
      availableAt: new Date(due.getTime() + 10 * 60_000),
    });
    // A retried row keeps its due time, so the window does not move with it.
    const late = new Date(due.getTime() + 2 * HOUR + 1);
    await expect(prepareReviewReminder({ ...pathBItem, availableAt: late }, late)).resolves.toEqual(
      { decision: 'cancel', reason: 'too_late' },
    );
  });

  it('rethrows an unexpected client error instead of hiding it', async () => {
    adaptive.fetch.mockRejectedValue(new TypeError('bug'));

    await expect(prepareReviewReminder(pathBItem, due)).rejects.toThrow('bug');
  });
});

describe('one-click unsubscribe (AC7)', () => {
  const token = unsubscribeToken(USER_ID, ENVIRONMENT['AUTH_SECRET'] ?? '');
  const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.preference.findOneAndUpdate.mockReturnValue(query({ studyReminders: true }));
    mocks.outbox.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  it('records an unsubscribe opt-out and cancels the pending email for a valid token', async () => {
    await expect(unsubscribeWithToken(token, '203.0.113.7')).resolves.toBe(true);

    expect(mocks.consentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: new Types.ObjectId(USER_ID),
        topic: 'study_reminders',
        action: 'opt_out',
        source: 'unsubscribe',
      }),
    );
    expect(mocks.consentEvent.create.mock.calls[0]?.[0]).not.toHaveProperty('campaign');
    expect(mocks.outbox.updateMany).toHaveBeenCalledWith(
      {
        userId: new Types.ObjectId(USER_ID),
        kind: { $in: ['review_reminder', 'review_reminder_d5'] },
        status: 'pending',
      },
      { $set: { status: 'canceled', lastError: 'opted_out' } },
    );
  });

  it('is idempotent: an already unsubscribed learner gets no second event', async () => {
    mocks.preference.findOneAndUpdate.mockReturnValue(query(null));
    mocks.consentEvent.exists.mockResolvedValue({ _id: new Types.ObjectId() });

    await expect(unsubscribeWithToken(token, null)).resolves.toBe(true);

    expect(mocks.consentEvent.create).not.toHaveBeenCalled();
    expect(mocks.outbox.updateMany).toHaveBeenCalledOnce();
  });

  it('records the opt-out for a learner who never opted in (activation nudge, RIN-999)', async () => {
    mocks.preference.findOneAndUpdate.mockReturnValue(query(null));
    mocks.consentEvent.exists.mockResolvedValue(null);

    await expect(unsubscribeWithToken(token, null)).resolves.toBe(true);

    expect(mocks.consentEvent.exists).toHaveBeenCalledWith({
      userId: new Types.ObjectId(USER_ID),
      action: 'opt_out',
    });
    expect(mocks.consentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'opt_out', source: 'unsubscribe' }),
    );
  });

  it('records the activation-nudge campaign on the opt-out event (RIN-1044)', async () => {
    mocks.preference.findOneAndUpdate.mockReturnValue(query(null));
    mocks.consentEvent.exists.mockResolvedValue(null);

    await expect(unsubscribeWithToken(token, null, 'activation_nudge')).resolves.toBe(true);

    expect(mocks.consentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'unsubscribe', campaign: 'activation_nudge' }),
    );
    expect(mocks.outbox.updateMany).toHaveBeenCalledOnce();
  });

  it('rejects a tampered token without touching the database', async () => {
    await expect(unsubscribeWithToken(tampered, null)).resolves.toBe(false);
    await expect(unsubscribeLinkState(tampered)).resolves.toBe('invalid');

    expect(mocks.preference.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.preference.findOne).not.toHaveBeenCalled();
    expect(mocks.outbox.updateMany).not.toHaveBeenCalled();
  });

  it('reads the page state: opted in or never opted out is subscribed', async () => {
    mocks.preference.findOne.mockReturnValue(query({ studyReminders: true }));
    await expect(unsubscribeLinkState(token)).resolves.toBe('subscribed');

    mocks.preference.findOne.mockReturnValue(query(null));
    mocks.consentEvent.exists.mockResolvedValue(null);
    await expect(unsubscribeLinkState(token)).resolves.toBe('subscribed');

    mocks.consentEvent.exists.mockResolvedValue({ _id: new Types.ObjectId() });
    await expect(unsubscribeLinkState(token)).resolves.toBe('unsubscribed');
  });
});

describe('review email kill switch', () => {
  it('sends unless REVIEW_REMINDER_SENDING_ENABLED is false', () => {
    expect(reviewReminderSendingEnabled({})).toBe(true);
    expect(reviewReminderSendingEnabled({ REVIEW_REMINDER_SENDING_ENABLED: 'true' })).toBe(true);
    expect(reviewReminderSendingEnabled({ REVIEW_REMINDER_SENDING_ENABLED: ' FALSE ' })).toBe(
      false,
    );
  });
});
