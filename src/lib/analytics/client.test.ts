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
    window.history.replaceState({}, '', '/');
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

    await vi.waitFor(() => expect(posthogMock.init).toHaveBeenCalledTimes(1));
    expect(posthogMock.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://us.i.posthog.com',
        autocapture: false,
        disable_session_recording: true,
      }),
    );
    expect(posthogMock.capture).toHaveBeenCalledWith(
      'pdf_upload_completed',
      expect.objectContaining({ duration_ms: 1200, landing_path: '/' }),
    );
    expect(document.querySelector('script[data-rinkuzu-analytics="google"]')).not.toBeNull();
    expect(window.dataLayer).toContainEqual([
      'event',
      'pdf_upload_completed',
      expect.objectContaining({ duration_ms: 1200, landing_path: '/' }),
    ]);
  });

  it('joins a consented landing to signup and activation without retaining query text', async () => {
    window.history.replaceState(
      {},
      '',
      '/en/pdf-to-quiz/?utm_source=threads&utm_medium=social&utm_campaign=launch_1&utm_content=demo-a&private=secret',
    );
    const analytics = await loadAnalytics();

    analytics.grantAnalyticsConsent();
    analytics.trackAnalyticsPageView(window.location.href, 'PDF to quiz');
    analytics.captureAnalyticsEvent('signup_completed', { method: 'credentials' });
    analytics.captureAnalyticsEvent('pdf_upload_completed', { file_size_bucket: '0_5_mb' });
    analytics.captureAnalyticsEventOnce('first_question_answered', 'synthetic-first-answer', {
      learning_mode: 'adaptive',
    });

    await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(4));
    const captures = posthogMock.capture.mock.calls.map(
      (call) => call[1] as Record<string, unknown>,
    );
    const landingIds = new Set(captures.map((properties) => properties['landing_id']));

    expect(landingIds.size).toBe(1);
    expect([...landingIds][0]).toEqual(expect.any(String));
    for (const properties of captures) {
      expect(properties).toMatchObject({
        landing_path: '/en/pdf-to-quiz',
        landing_referrer_class: 'direct',
        utm_source: 'threads',
        utm_medium: 'social',
        utm_campaign: 'launch_1',
        utm_content: 'demo-a',
      });
      expect(JSON.stringify(properties)).not.toContain('private');
      expect(JSON.stringify(properties)).not.toContain('secret');
    }
    expect(captures[0]?.['$current_url']).toBe('http://localhost:3000/en/pdf-to-quiz');
  });

  it('reports a missing-consent journey separately by emitting and storing no attribution', async () => {
    window.history.replaceState({}, '', '/en/?utm_source=private-value');
    const analytics = await loadAnalytics();

    analytics.trackAnalyticsPageView(window.location.href, 'Landing');
    analytics.captureAnalyticsEvent('signup_completed');

    expect(posthogMock.capture).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('rinkuzu_landing_attribution_v1')).toBeNull();
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

    await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(1));
    expect(posthogMock.capture).toHaveBeenCalledTimes(1);
  });

  it('disables providers on revoke and opts PostHog back in when consent is granted again', async () => {
    const analytics = await loadAnalytics();

    analytics.grantAnalyticsConsent();
    await vi.waitFor(() => expect(posthogMock.init).toHaveBeenCalledTimes(1));
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
