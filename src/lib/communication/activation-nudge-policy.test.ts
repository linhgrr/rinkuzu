import { describe, expect, it } from 'vitest';

import {
  activationClickToken,
  activationClickUrl,
  activationNudgeCtaUrl,
  activationNudgeDedupeKey,
  activationNudgeFirstName,
  activationNudgeLocale,
  activationNudgeSendingEnabled,
  activationNudgeSignupWindow,
  evaluateActivationNudge,
  type ActivationNudgeFacts,
  verifyActivationClickToken,
} from './activation-nudge-policy';

const HOUR = 3_600_000;
const NOW = new Date('2026-11-06T12:00:00.000Z');
const LEARNER = {
  email: 'learner@gmail.com',
  role: 'user',
  disable: 0,
  isTestAccount: false,
  createdAt: new Date(NOW.getTime() - 25 * HOUR),
};

function facts(overrides: Partial<ActivationNudgeFacts> = {}): ActivationNudgeFacts {
  return {
    now: NOW,
    user: LEARNER,
    activated: false,
    unsubscribed: false,
    alreadyNudged: false,
    ...overrides,
  };
}

describe('activation nudge eligibility (RIN-999)', () => {
  it('sends to a non-activated learner 24 h after signup', () => {
    expect(evaluateActivationNudge(facts())).toEqual({ decision: 'send' });
    const exactly24h = { ...LEARNER, createdAt: new Date(NOW.getTime() - 24 * HOUR) };
    expect(evaluateActivationNudge(facts({ user: exactly24h }))).toEqual({ decision: 'send' });
  });

  it.each([
    [
      'under 24 h since signup',
      { user: { ...LEARNER, createdAt: new Date(NOW.getTime() - 23 * HOUR) } },
      'too_early',
    ],
    ['activated', { activated: true }, 'activated'],
    ['unsubscribed', { unsubscribed: true }, 'unsubscribed'],
    ['already nudged', { alreadyNudged: true }, 'already_nudged'],
    ['missing user', { user: null }, 'user_missing'],
    ['admin', { user: { ...LEARNER, role: 'admin' } }, 'excluded_account'],
    ['disabled', { user: { ...LEARNER, disable: 1 } }, 'excluded_account'],
    ['flagged test account', { user: { ...LEARNER, isTestAccount: true } }, 'excluded_account'],
    ['reserved domain', { user: { ...LEARNER, email: 'qa@example.com' } }, 'excluded_account'],
    [
      'listed company address',
      { user: { ...LEARNER, email: 'rinkuzu-ops@fldubai.com' } },
      'excluded_account',
    ],
  ] as const)('skips: %s', (_label, overrides, reason) => {
    expect(evaluateActivationNudge(facts(overrides))).toEqual({ decision: 'skip', reason });
  });

  it('stops a 24h nudge after the 7-day look-back, but not a backfill one', () => {
    const late = { ...LEARNER, createdAt: new Date(NOW.getTime() - 7 * 24 * HOUR - 1) };
    expect(evaluateActivationNudge(facts({ user: late, trigger: '24h' }))).toEqual({
      decision: 'skip',
      reason: 'too_late',
    });
    expect(evaluateActivationNudge(facts({ user: late }))).toEqual({
      decision: 'skip',
      reason: 'too_late',
    });
    expect(evaluateActivationNudge(facts({ user: late, trigger: 'backfill' }))).toEqual({
      decision: 'send',
    });
    const lastMoment = { ...LEARNER, createdAt: new Date(NOW.getTime() - 7 * 24 * HOUR) };
    expect(evaluateActivationNudge(facts({ user: lastMoment }))).toEqual({ decision: 'send' });
  });

  it('sweeps signups in (now − 7 d, now − 24 h]', () => {
    expect(activationNudgeSignupWindow(NOW)).toEqual({
      after: new Date('2026-10-30T12:00:00.000Z'),
      until: new Date('2026-11-05T12:00:00.000Z'),
    });
  });

  it('keys one row per account for its lifetime', () => {
    expect(activationNudgeDedupeKey('6a8ed209f04328ac17443d91')).toBe(
      'activation_nudge:6a8ed209f04328ac17443d91',
    );
  });

  it('defaults the locale to vi and honours the kill switch', () => {
    expect(activationNudgeLocale('en')).toBe('en');
    expect(activationNudgeLocale(null)).toBe('vi');
    expect(activationNudgeLocale('fr')).toBe('vi');
    expect(activationNudgeSendingEnabled({})).toBe(true);
    expect(activationNudgeSendingEnabled({ ACTIVATION_NUDGE_SENDING_ENABLED: ' False ' })).toBe(
      false,
    );
  });
});

describe('activation nudge first name and CTA', () => {
  it('uses the given name only', () => {
    expect(activationNudgeFirstName('Nguyễn Văn An', 'vi')).toBe('An');
    expect(activationNudgeFirstName('Jamie Rivera', 'en')).toBe('Jamie');
    expect(activationNudgeFirstName('  ', 'en')).toBeNull();
    expect(activationNudgeFirstName(null, 'vi')).toBeNull();
    expect(activationNudgeFirstName('user_123', 'en')).toBeNull();
  });

  it('points at the locale-matched starter quiz with the entry and UTM params', () => {
    const allowlist = [
      { slug: 'vi-starter', locale: 'vi' },
      { slug: 'en-starter', locale: 'en' },
    ];
    const en = new URL(
      activationNudgeCtaUrl({ siteUrl: 'https://www.rinkuzu.app', locale: 'en', allowlist }),
    );
    expect(en.pathname).toBe('/en/quiz/en-starter');
    expect(Object.fromEntries(en.searchParams)).toEqual({
      entry: 'activation_email',
      utm_source: 'email',
      utm_campaign: 'activation_nudge',
    });
    expect(
      activationNudgeCtaUrl({ siteUrl: 'https://www.rinkuzu.app', locale: 'vi', allowlist }),
    ).toContain('/vi/quiz/vi-starter?entry=activation_email');
  });
});

describe('activation click token (RIN-1000)', () => {
  const SECRET = 'test-secret';
  const USER = '0123456789abcdef01234567';
  const SENT = new Date('2026-11-06T12:00:00.000Z');

  it('verifies a fresh token for its user and rejects a forged, foreign or expired one', () => {
    const token = activationClickToken(USER, SECRET, SENT);
    expect(verifyActivationClickToken(token, SECRET, new Date(SENT.getTime() + HOUR))).toEqual({
      userId: USER,
    });
    expect(verifyActivationClickToken(token, 'other-secret', SENT)).toBeNull();
    expect(verifyActivationClickToken(`${token.slice(0, -1)}A`, SECRET, SENT)).toBeNull();
    expect(verifyActivationClickToken('not-a-token', SECRET, SENT)).toBeNull();
    expect(verifyActivationClickToken('', SECRET, SENT)).toBeNull();
    const later = new Date(SENT.getTime() + 31 * 24 * HOUR);
    expect(verifyActivationClickToken(token, SECRET, later)).toBeNull();
  });

  it('builds the tracked click URL with the token and the locale', () => {
    const url = new URL(activationClickUrl('https://www.rinkuzu.app', 'en', 'tok.en'));
    expect(url.pathname).toBe('/api/email/activation-click');
    expect(Object.fromEntries(url.searchParams)).toEqual({ t: 'tok.en', l: 'en' });
  });
});
