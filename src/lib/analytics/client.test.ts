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
    window.sessionStorage.clear();
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
      { send_instantly: true, transport: 'sendBeacon' },
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

  it('captures a pending login only after identity continuity is established', async () => {
    const analytics = await loadAnalytics();
    analytics.grantAnalyticsConsent();
    analytics.markAnalyticsLoginPending('google', 'en');

    await analytics.identifyAnalyticsUser('opaque-user-id', { role: 'user' });
    analytics.capturePendingAnalyticsLogin();

    await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(1));
    expect(posthogMock.identify).toHaveBeenCalledWith('opaque-user-id', { role: 'user' });
    expect(posthogMock.capture).toHaveBeenCalledWith(
      'login_completed',
      expect.objectContaining({
        method: 'google',
        locale: 'en',
      }),
      { send_instantly: true, transport: 'sendBeacon' },
    );
    expect(posthogMock.identify.mock.invocationCallOrder[0]).toBeLessThan(
      posthogMock.capture.mock.invocationCallOrder[0] ?? 0,
    );
    expect(window.sessionStorage.length).toBe(0);
  });

  it('completes a pending Google auth as a signup when the server created the account', async () => {
    const analytics = await loadAnalytics();
    analytics.grantAnalyticsConsent();
    analytics.markAnalyticsGoogleAuthPending('vi');

    await analytics.identifyAnalyticsUser('new-google-user', { role: 'user' });
    analytics.capturePendingAnalyticsLogin({ isNewAccount: true });

    await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(1));
    expect(posthogMock.capture).toHaveBeenCalledWith(
      'signup_completed',
      expect.objectContaining({ method: 'google', locale: 'vi', journey_id: expect.any(String) }),
      { send_instantly: true, transport: 'sendBeacon' },
    );
    expect(window.sessionStorage.length).toBe(0);
  });

  it('completes a pending Google auth as a login when the account already existed', async () => {
    const analytics = await loadAnalytics();
    analytics.grantAnalyticsConsent();
    analytics.markAnalyticsGoogleAuthPending('en');

    await analytics.identifyAnalyticsUser('existing-google-user', { role: 'user' });
    analytics.capturePendingAnalyticsLogin({ isNewAccount: false });

    await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(1));
    expect(posthogMock.capture).toHaveBeenCalledWith(
      'login_completed',
      expect.objectContaining({ method: 'google', locale: 'en' }),
      { send_instantly: true, transport: 'sendBeacon' },
    );
  });

  it('never reclassifies a credentials login as a signup', async () => {
    const analytics = await loadAnalytics();
    analytics.grantAnalyticsConsent();
    analytics.markAnalyticsLoginPending('credentials', 'en');

    await analytics.identifyAnalyticsUser('credentials-user', { role: 'user' });
    analytics.capturePendingAnalyticsLogin({ isNewAccount: true });

    await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(1));
    expect(posthogMock.capture).toHaveBeenCalledWith(
      'login_completed',
      expect.objectContaining({ method: 'credentials' }),
      { send_instantly: true, transport: 'sendBeacon' },
    );
  });

  it('does not mark or capture a Google auth when consent is withheld', async () => {
    const analytics = await loadAnalytics();
    analytics.denyAnalyticsConsent();
    analytics.markAnalyticsGoogleAuthPending('en');

    analytics.capturePendingAnalyticsLogin({ isNewAccount: true });

    expect(window.sessionStorage.length).toBe(0);
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });

  it('captures verified signup only after PostHog identifies the user', async () => {
    const analytics = await loadAnalytics();
    analytics.grantAnalyticsConsent();
    analytics.markAnalyticsSignupPending('credentials', 'en');

    analytics.capturePendingAnalyticsSignup();
    expect(posthogMock.capture).not.toHaveBeenCalled();

    await analytics.identifyAnalyticsUser('user-verified', { role: 'user' });
    analytics.capturePendingAnalyticsSignup();

    await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(1));
    expect(posthogMock.identify).toHaveBeenCalledWith('user-verified', { role: 'user' });
    expect(posthogMock.capture).toHaveBeenCalledWith(
      'signup_completed',
      expect.objectContaining({
        method: 'credentials',
        locale: 'en',
        journey_id: expect.any(String),
      }),
      { send_instantly: true, transport: 'sendBeacon' },
    );
    expect(window.localStorage.getItem('rinkuzu_analytics_pending_signup_v1')).toBeNull();
  });

  it('scopes first-question markers to the identified user', async () => {
    const analytics = await loadAnalytics();
    analytics.grantAnalyticsConsent();

    await analytics.identifyAnalyticsUser('user-a');
    analytics.captureAnalyticsEventOnce('first_question_answered', 'first-answer');
    analytics.captureAnalyticsEventOnce('first_question_answered', 'first-answer');

    await analytics.identifyAnalyticsUser('user-b');
    analytics.captureAnalyticsEventOnce('first_question_answered', 'first-answer');

    await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(2));
  });

  it('delivers the privacy-bounded upload failure guardrail', async () => {
    const analytics = await loadAnalytics();
    analytics.grantAnalyticsConsent();

    analytics.captureAnalyticsEvent('pdf_upload_failed', {
      file_size_bucket: '6_15_mb',
      reason: 'service_unavailable',
      duration_ms: 450,
    });

    await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(1));
    expect(posthogMock.capture).toHaveBeenCalledWith(
      'pdf_upload_failed',
      expect.objectContaining({
        file_size_bucket: '6_15_mb',
        reason: 'service_unavailable',
        duration_ms: 450,
      }),
      { send_instantly: true, transport: 'sendBeacon' },
    );
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

  describe('pipeline terminal events', () => {
    it('emits pipeline_failed once per run with a slug error code and no raw text', async () => {
      const analytics = await loadAnalytics();
      analytics.grantAnalyticsConsent();

      const event = {
        path: 'adaptive',
        runKey: 'job-1:0',
        outcome: 'failed',
        errorCode: 'ocr_failed',
        journeyId: 'journey-1',
        durationMs: 1234.4,
      } as const;
      analytics.capturePipelineTerminalEventOnce(event);
      analytics.capturePipelineTerminalEventOnce(event);

      await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(1));
      expect(posthogMock.capture).toHaveBeenCalledWith(
        'pipeline_failed',
        expect.objectContaining({
          path: 'adaptive',
          journey_id: 'journey-1',
          duration_ms: 1234,
          error_code: 'ocr_failed',
        }),
        { send_instantly: true, transport: 'sendBeacon' },
      );
      expect(posthogMock.capture.mock.calls[0]?.[1]).not.toHaveProperty('runKey');
    });

    it('dedupes across a reload because the emitted set lives in localStorage', async () => {
      const first = await loadAnalytics();
      first.grantAnalyticsConsent();
      first.capturePipelineTerminalEventOnce({
        path: 'quiz_draft',
        runKey: 'draft-1',
        outcome: 'completed',
      });
      await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(1));

      const reloaded = await loadAnalytics();
      reloaded.capturePipelineTerminalEventOnce({
        path: 'quiz_draft',
        runKey: 'draft-1',
        outcome: 'completed',
      });
      reloaded.capturePipelineTerminalEventOnce({
        path: 'quiz_draft',
        runKey: 'draft-2',
        outcome: 'completed',
      });

      await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalledTimes(2));
      expect(posthogMock.capture.mock.calls[0]?.[0]).toBe('pipeline_completed');
      expect(posthogMock.capture.mock.calls[0]?.[1]).not.toHaveProperty('error_code');
    });

    it('records nothing without consent', async () => {
      const analytics = await loadAnalytics();

      analytics.capturePipelineTerminalEventOnce({
        path: 'adaptive',
        runKey: 'job-1:0',
        outcome: 'completed',
      });

      expect(window.localStorage.getItem('rinkuzu_analytics_pipeline_terminal_v1')).toBeNull();
      expect(posthogMock.capture).not.toHaveBeenCalled();
    });

    it.each([
      ['pipeline_timeout', 'pipeline_timeout'],
      ['OCR_FAILED', 'ocr_failed'],
      ['OCR API request failed for all configured keys.', 'unknown'],
      [null, 'unknown'],
      [undefined, 'unknown'],
    ])('normalizes error code %s to %s', async (code, expected) => {
      const analytics = await loadAnalytics();
      expect(analytics.normalizePipelineErrorCode(code)).toBe(expected);
    });
  });
});
