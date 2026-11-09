// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: posthogMock }));

async function loadModules() {
  vi.resetModules();
  const [touch, analytics] = await Promise.all([import('./quiz-first-touch'), import('./client')]);
  return { ...touch, analytics };
}

function signupProperties(): Record<string, unknown> | undefined {
  const call = posthogMock.capture.mock.calls.find((args) => args[0] === 'signup_completed');
  return call?.[1] as Record<string, unknown> | undefined;
}

describe('quiz first touch (RIN-1242)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('keeps post only next to entry=blog', async () => {
    const { rememberQuizFirstTouch, readQuizFirstTouch } = await loadModules();

    rememberQuizFirstTouch({ entry: 'landing', post: 'hoc-tieng-nhat' });

    expect(readQuizFirstTouch()).toEqual({ entry: 'landing' });
  });

  it('drops an invalid post but keeps the blog entry', async () => {
    const { rememberQuizFirstTouch, readQuizFirstTouch } = await loadModules();

    rememberQuizFirstTouch({ entry: 'blog', post: '../Bad Slug' });

    expect(readQuizFirstTouch()).toEqual({ entry: 'blog' });
  });

  it('stores nothing for an untracked entry', async () => {
    const { rememberQuizFirstTouch, readQuizFirstTouch } = await loadModules();

    rememberQuizFirstTouch({ entry: 'newsletter' });

    expect(readQuizFirstTouch()).toEqual({});
    expect(window.sessionStorage.length).toBe(0);
  });

  it('lets the first touch win over a later entry', async () => {
    const { rememberQuizFirstTouch, readQuizFirstTouch } = await loadModules();

    rememberQuizFirstTouch({ entry: 'blog', post: 'on-thi-jlpt' });
    rememberQuizFirstTouch({ entry: 'landing' });

    expect(readQuizFirstTouch()).toEqual({ entry: 'blog', post: 'on-thi-jlpt' });
  });

  it('re-validates a tampered stored value', async () => {
    const { readQuizFirstTouch } = await loadModules();

    window.sessionStorage.setItem(
      'rinkuzu_quiz_first_touch_v1',
      JSON.stringify({ entry: 'blog', post: 'x'.repeat(200) }),
    );
    expect(readQuizFirstTouch()).toEqual({ entry: 'blog' });

    window.sessionStorage.setItem('rinkuzu_quiz_first_touch_v1', '{not json');
    expect(readQuizFirstTouch()).toEqual({});
  });

  it('never throws when storage is unavailable', async () => {
    const { rememberQuizFirstTouch, readQuizFirstTouch } = await loadModules();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(() => rememberQuizFirstTouch({ entry: 'blog', post: 'on-thi-jlpt' })).not.toThrow();
    expect(readQuizFirstTouch()).toEqual({});
  });

  it('adds the first touch to a Google signup_completed', async () => {
    const { rememberQuizFirstTouch, analytics } = await loadModules();
    rememberQuizFirstTouch({ entry: 'blog', post: 'on-thi-jlpt' });
    analytics.grantAnalyticsConsent();
    analytics.markAnalyticsGoogleAuthPending('vi');

    await analytics.identifyAnalyticsUser('new-google-user');
    analytics.capturePendingAnalyticsLogin({ isNewAccount: true });

    await vi.waitFor(() => expect(signupProperties()).toBeDefined());
    expect(signupProperties()).toMatchObject({
      method: 'google',
      entry: 'blog',
      post: 'on-thi-jlpt',
    });
  });

  it('carries the first touch into a credentials signup verified in another tab', async () => {
    const { rememberQuizFirstTouch, analytics } = await loadModules();
    rememberQuizFirstTouch({ entry: 'blog', post: 'on-thi-jlpt' });
    analytics.grantAnalyticsConsent();
    analytics.markAnalyticsSignupPending('credentials', 'en');
    // The verification link opens a new tab: a fresh sessionStorage.
    window.sessionStorage.clear();

    await analytics.identifyAnalyticsUser('user-verified');
    analytics.capturePendingAnalyticsSignup();

    await vi.waitFor(() => expect(signupProperties()).toBeDefined());
    expect(signupProperties()).toMatchObject({
      method: 'credentials',
      entry: 'blog',
      post: 'on-thi-jlpt',
    });
  });

  it('sends no entry on signup_completed without a first touch', async () => {
    const { analytics } = await loadModules();
    analytics.grantAnalyticsConsent();
    analytics.markAnalyticsSignupPending('credentials', 'en');

    await analytics.identifyAnalyticsUser('user-verified');
    analytics.capturePendingAnalyticsSignup();

    await vi.waitFor(() => expect(signupProperties()).toBeDefined());
    expect(signupProperties()).not.toHaveProperty('entry');
    expect(signupProperties()).not.toHaveProperty('post');
  });
});
