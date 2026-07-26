// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: posthogMock }));

async function loadAnalytics() {
  vi.resetModules();
  return import('./client');
}

describe('analytics client', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.head.innerHTML = '';
    delete window.dataLayer;
    delete window.gtag;
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST123');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com');
  });

  it('does not initialize or capture before consent', async () => {
    const analytics = await loadAnalytics();

    analytics.captureAnalyticsEvent('signup_started', { method: 'credentials' });

    expect(posthogMock.init).not.toHaveBeenCalled();
    expect(posthogMock.capture).not.toHaveBeenCalled();
    expect(document.querySelector('script[data-rinkuzu-analytics="google"]')).toBeNull();
  });

  it('initializes both providers only after consent and captures sanitized properties', async () => {
    const analytics = await loadAnalytics();

    analytics.grantAnalyticsConsent();
    analytics.captureAnalyticsEvent('pdf_upload_completed', {
      duration_ms: 1200,
      ignored: undefined,
    });

    expect(posthogMock.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://us.i.posthog.com',
        autocapture: false,
        disable_session_recording: true,
      }),
    );
    expect(posthogMock.capture).toHaveBeenCalledWith('pdf_upload_completed', {
      duration_ms: 1200,
    });
    expect(document.querySelector('script[data-rinkuzu-analytics="google"]')).not.toBeNull();
    expect(window.dataLayer).toContainEqual([
      'event',
      'pdf_upload_completed',
      { duration_ms: 1200 },
    ]);
  });

  it('captures one-time activation events once', async () => {
    const analytics = await loadAnalytics();
    analytics.grantAnalyticsConsent();

    analytics.captureAnalyticsEventOnce('first_question_answered', 'first-answer', {
      learning_mode: 'adaptive',
    });
    analytics.captureAnalyticsEventOnce('first_question_answered', 'first-answer', {
      learning_mode: 'adaptive',
    });

    expect(posthogMock.capture).toHaveBeenCalledTimes(1);
  });

  it('disables providers on revoke and opts PostHog back in when consent is granted again', async () => {
    const analytics = await loadAnalytics();

    analytics.grantAnalyticsConsent();
    analytics.denyAnalyticsConsent();

    expect(posthogMock.opt_out_capturing).toHaveBeenCalledTimes(1);
    expect(Reflect.get(window, 'ga-disable-G-TEST123')).toBe(true);

    analytics.grantAnalyticsConsent();

    expect(posthogMock.opt_in_capturing).toHaveBeenCalledTimes(1);
    expect(Reflect.get(window, 'ga-disable-G-TEST123')).toBe(false);
  });

  it.each([
    [1 * 1024 * 1024, '0_5_mb'],
    [10 * 1024 * 1024, '6_15_mb'],
    [20 * 1024 * 1024, '16_30_mb'],
    [40 * 1024 * 1024, '31_50_mb'],
  ])('buckets %i bytes as %s', async (sizeBytes, expected) => {
    const analytics = await loadAnalytics();
    expect(analytics.fileSizeBucket(sizeBytes)).toBe(expected);
  });
});
