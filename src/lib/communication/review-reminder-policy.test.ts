import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  evaluateReviewReminder,
  REVIEW_REMINDER_CAMPAIGN,
  reviewReminderAvailableAt,
  reviewReminderDedupeKey,
  reviewReminderQaRecipients,
  reviewRetryUrl,
  oneClickUnsubscribeUrl,
  unsubscribeCampaign,
  unsubscribePageUrl,
  unsubscribeToken,
  verifyUnsubscribeToken,
  type ReviewReminderFacts,
} from './review-reminder-policy';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const TAKEN_AT = new Date('2026-11-02T10:00:00.000Z');
const DUE = new Date(TAKEN_AT.getTime() + 48 * HOUR);
const SECRET = 'test-auth-secret-at-least-32-characters';
const USER_ID = '6a8ed209f04328ac17443d91';
const LEARNER = {
  email: 'learner@gmail.com',
  role: 'user',
  disable: 0,
  isTestAccount: false,
};

function facts(overrides: Partial<ReviewReminderFacts> = {}): ReviewReminderFacts {
  return {
    now: new Date(),
    availableAt: DUE,
    user: LEARNER,
    optedIn: true,
    laterAttempt: false,
    sentInLastWeek: false,
    qaRecipients: new Set(),
    ...overrides,
  };
}

describe('review reminder eligibility (AC5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits until 48 h after the attempt, then sends', () => {
    vi.setSystemTime(new Date(DUE.getTime() - 1));
    expect(evaluateReviewReminder(facts())).toEqual({ decision: 'wait' });
    vi.setSystemTime(DUE);
    expect(evaluateReviewReminder(facts())).toEqual({ decision: 'send', qa: false });
  });

  it.each([
    ['at 48 h', 0, { decision: 'send', qa: false }],
    ['at 49 h 59 m', HOUR + 59 * MINUTE, { decision: 'send', qa: false }],
    ['at exactly 50 h', 2 * HOUR, { decision: 'send', qa: false }],
    ['at 50 h 01 m', 2 * HOUR + MINUTE, { decision: 'cancel', reason: 'too_late' }],
    ['days late', 5 * 24 * HOUR, { decision: 'cancel', reason: 'too_late' }],
  ] as const)('decides %s after the attempt', (_label, afterDue, expected) => {
    vi.setSystemTime(new Date(DUE.getTime() + afterDue));
    expect(evaluateReviewReminder(facts())).toEqual(expected);
  });

  it('cancels a late send for QA recipients too', () => {
    vi.setSystemTime(new Date(DUE.getTime() + 2 * HOUR + MINUTE));
    const qa = { ...LEARNER, email: 'rinkuzu-ops@fldubai.com', role: 'admin' };
    const qaRecipients = reviewReminderQaRecipients({
      REVIEW_EMAIL_QA_RECIPIENTS: 'rinkuzu-ops@fldubai.com',
    });
    expect(evaluateReviewReminder(facts({ user: qa, qaRecipients }))).toEqual({
      decision: 'cancel',
      reason: 'too_late',
    });
  });

  it.each([
    ['a later attempt', { laterAttempt: true }, 'later_attempt'],
    ['an opt-out or unsubscribe since', { optedIn: false }, 'opted_out'],
    ['another review email in the last 7 days', { sentInLastWeek: true }, 'weekly_cap'],
    ['a deleted account', { user: null }, 'user_missing'],
    ['a disabled account', { user: { ...LEARNER, disable: 1 } }, 'account_disabled'],
    ['a test account', { user: { ...LEARNER, isTestAccount: true } }, 'excluded_account'],
    ['an admin', { user: { ...LEARNER, role: 'admin' } }, 'excluded_account'],
    [
      'a reserved test domain',
      { user: { ...LEARNER, email: 'qa@rinkuzu.test' } },
      'excluded_account',
    ],
    [
      'a listed company address',
      { user: { ...LEARNER, email: 'rinkuzu-ops@fldubai.com' } },
      'excluded_account',
    ],
  ] as const)('cancels on %s', (_label, overrides, reason) => {
    vi.setSystemTime(DUE);
    expect(evaluateReviewReminder(facts(overrides))).toEqual({ decision: 'cancel', reason });
  });

  it('lets the QA allowlist bypass only the exclusion rule', () => {
    vi.setSystemTime(DUE);
    const ops = { ...LEARNER, email: 'rinkuzu-ops@fldubai.com', role: 'admin' };
    const qaRecipients = reviewReminderQaRecipients({
      REVIEW_EMAIL_QA_RECIPIENTS: ' Rinkuzu-Ops@fldubai.com , ',
    });
    expect(evaluateReviewReminder(facts({ user: ops, qaRecipients }))).toEqual({
      decision: 'send',
      qa: true,
    });
    const alwaysApply: Array<[Partial<ReviewReminderFacts>, string]> = [
      [{ laterAttempt: true }, 'later_attempt'],
      [{ optedIn: false }, 'opted_out'],
      [{ sentInLastWeek: true }, 'weekly_cap'],
      [{ user: { ...ops, disable: 1 } }, 'account_disabled'],
    ];
    for (const [overrides, reason] of alwaysApply) {
      expect(evaluateReviewReminder(facts({ user: ops, qaRecipients, ...overrides }))).toEqual({
        decision: 'cancel',
        reason,
      });
    }
  });
});

describe('review reminder schedule', () => {
  it('is due 48 h after the attempt and refuses an opt-in after 46 h', () => {
    const now = new Date(TAKEN_AT.getTime() + HOUR);
    expect(
      reviewReminderAvailableAt({ takenAt: TAKEN_AT, email: 'a@gmail.com', now, env: {} }),
    ).toEqual(DUE);
    expect(
      reviewReminderAvailableAt({
        takenAt: TAKEN_AT,
        email: 'a@gmail.com',
        now: new Date(TAKEN_AT.getTime() + 46 * HOUR + 1),
        env: {},
      }),
    ).toBeNull();
  });

  it('shortens the delay for QA recipients only', () => {
    const env = {
      REVIEW_EMAIL_QA_RECIPIENTS: 'qa@fldubai.com',
      REVIEW_EMAIL_QA_DELAY_MINUTES: '5',
    };
    const dueFor = (email: string, environment: Record<string, string>) =>
      reviewReminderAvailableAt({ takenAt: TAKEN_AT, email, now: TAKEN_AT, env: environment });
    expect(dueFor('qa@fldubai.com', env)).toEqual(new Date(TAKEN_AT.getTime() + 5 * MINUTE));
    expect(dueFor('learner@gmail.com', env)).toEqual(DUE);
    expect(dueFor('qa@fldubai.com', { REVIEW_EMAIL_QA_RECIPIENTS: 'qa@fldubai.com' })).toEqual(DUE);
    // A late QA opt-in is sent at the next tick instead of being refused.
    const late = new Date(TAKEN_AT.getTime() + 50 * HOUR);
    expect(
      reviewReminderAvailableAt({ takenAt: TAKEN_AT, email: 'qa@fldubai.com', now: late, env }),
    ).toEqual(late);
  });

  it('keys at most one row per learner per 7-day bucket', () => {
    const key = reviewReminderDedupeKey(USER_ID, DUE);
    expect(key).toBe(reviewReminderDedupeKey(USER_ID, new Date(DUE.getTime() + HOUR)));
    expect(key).not.toBe(reviewReminderDedupeKey(USER_ID, new Date(DUE.getTime() + 7 * 24 * HOUR)));
    expect(key).not.toContain('@');
  });

  it('links to the retry session with the campaign UTM', () => {
    expect(
      reviewRetryUrl({
        siteUrl: 'https://www.rinkuzu.app',
        locale: 'en',
        slug: 'cell-biology',
        attemptId: USER_ID,
      }),
    ).toBe(
      `https://www.rinkuzu.app/en/quiz/cell-biology?retryOf=${USER_ID}&utm_source=email&utm_campaign=${REVIEW_REMINDER_CAMPAIGN}`,
    );
  });
});

describe('unsubscribe token', () => {
  it('verifies an authentic token and rejects every tampered one', () => {
    const token = unsubscribeToken(USER_ID, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({
      userId: USER_ID,
      topic: 'study_reminders',
    });
    expect(
      verifyUnsubscribeToken(token.replace(USER_ID, '6a8ed209f04328ac17443d92'), SECRET),
    ).toBeNull();
    const lastChar = token.endsWith('A') ? 'B' : 'A';
    expect(verifyUnsubscribeToken(`${token.slice(0, -1)}${lastChar}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(token, `${SECRET}x`)).toBeNull();
    expect(verifyUnsubscribeToken('garbage', SECRET)).toBeNull();
    expect(
      verifyUnsubscribeToken(token.replace('study_reminders', 'promotions'), SECRET),
    ).toBeNull();
  });

  it('builds the localized footer link and the one-click header URL', () => {
    expect(unsubscribePageUrl('https://www.rinkuzu.app', 'en', 'abc.def')).toBe(
      'https://www.rinkuzu.app/en/unsubscribe?t=abc.def',
    );
    expect(oneClickUnsubscribeUrl('https://www.rinkuzu.app', 'abc.def')).toBe(
      'https://www.rinkuzu.app/api/unsubscribe?t=abc.def',
    );
  });

  it('tags activation-nudge links with their campaign and ignores unknown ones (RIN-1044)', () => {
    expect(unsubscribePageUrl('https://www.rinkuzu.app', 'vi', 'abc.def', 'activation_nudge')).toBe(
      'https://www.rinkuzu.app/vi/unsubscribe?t=abc.def&c=activation_nudge',
    );
    expect(oneClickUnsubscribeUrl('https://www.rinkuzu.app', 'abc.def', 'activation_nudge')).toBe(
      'https://www.rinkuzu.app/api/unsubscribe?t=abc.def&c=activation_nudge',
    );
    expect(unsubscribeCampaign('activation_nudge')).toBe('activation_nudge');
    expect(unsubscribeCampaign('w1-review')).toBeNull();
    expect(unsubscribeCampaign(['activation_nudge'])).toBeNull();
  });
});
