'use client';

const ANALYTICS_CONSENT_STORAGE_KEY = 'rinkuzu_analytics_consent_v1';
const ANALYTICS_CONSENT_CHANGE_EVENT = 'rinkuzu:analytics-consent-change';

export type AnalyticsConsent = 'granted' | 'denied';

export type AnalyticsEventName =
  | 'signup_started'
  | 'signup_completed'
  | 'login_completed'
  | 'pdf_upload_started'
  | 'pdf_upload_completed'
  | 'pdf_upload_failed'
  | 'adaptive_session_started'
  | 'adaptive_answer_submitted'
  | 'first_question_answered'
  | 'quiz_completed';

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const posthogToken = process.env['NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN'];
const posthogHost = process.env['NEXT_PUBLIC_POSTHOG_HOST'] ?? 'https://us.i.posthog.com';
const googleAnalyticsId = process.env['NEXT_PUBLIC_GA_ID'];

type PostHogClient = typeof import('posthog-js').default;

let posthogClient: PostHogClient | null = null;
let posthogLoadPromise: Promise<PostHogClient | null> | null = null;
let googleAnalyticsInitialized = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function sanitizeProperties(
  properties: AnalyticsProperties,
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(properties).filter(
      (entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined,
    ),
  );
}

export function getAnalyticsConsent(): AnalyticsConsent | null {
  if (!isBrowser()) return null;
  const stored = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
  return stored === 'granted' || stored === 'denied' ? stored : null;
}

export function subscribeToAnalyticsConsent(onStoreChange: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

async function initializePostHog(): Promise<PostHogClient | null> {
  if (!isBrowser() || getAnalyticsConsent() !== 'granted' || !posthogToken) {
    return null;
  }
  if (posthogClient) return posthogClient;
  if (posthogLoadPromise) return posthogLoadPromise;

  posthogLoadPromise = import('posthog-js')
    .then(({ default: client }) => {
      if (getAnalyticsConsent() !== 'granted') return null;
      client.init(posthogToken, {
        api_host: posthogHost,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: true,
        disable_session_recording: true,
        person_profiles: 'identified_only',
      });
      posthogClient = client;
      return client;
    })
    .catch(() => null)
    .finally(() => {
      posthogLoadPromise = null;
    });
  return posthogLoadPromise;
}

function initializeGoogleAnalytics(): void {
  if (!isBrowser() || googleAnalyticsInitialized || !googleAnalyticsId) return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', googleAnalyticsId, {
    send_page_view: false,
    anonymize_ip: true,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAnalyticsId)}`;
  script.dataset['rinkuzuAnalytics'] = 'google';
  document.head.appendChild(script);
  googleAnalyticsInitialized = true;
}

export async function initializeAnalytics(): Promise<boolean> {
  if (getAnalyticsConsent() !== 'granted') return false;
  initializeGoogleAnalytics();
  const client = await initializePostHog();
  return Boolean(client) || googleAnalyticsInitialized;
}

export function grantAnalyticsConsent(): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'granted');
  if (googleAnalyticsId) {
    Reflect.set(window, `ga-disable-${googleAnalyticsId}`, false);
  }
  if (posthogClient) {
    posthogClient.opt_in_capturing();
  }
  void initializeAnalytics();
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGE_EVENT));
}

export function denyAnalyticsConsent(): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'denied');
  if (googleAnalyticsId) {
    Reflect.set(window, `ga-disable-${googleAnalyticsId}`, true);
  }
  if (posthogClient) {
    posthogClient.opt_out_capturing();
    posthogClient.reset();
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGE_EVENT));
}

export function captureAnalyticsEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): void {
  if (getAnalyticsConsent() !== 'granted') return;
  const sanitized = sanitizeProperties(properties);

  initializeGoogleAnalytics();
  window.gtag?.('event', event, sanitized);
  void initializePostHog().then((client) => {
    if (client && getAnalyticsConsent() === 'granted') client.capture(event, sanitized);
  });
}

export function captureAnalyticsEventOnce(
  event: AnalyticsEventName,
  storageKey: string,
  properties: AnalyticsProperties = {},
): void {
  if (!isBrowser() || getAnalyticsConsent() !== 'granted') return;
  const key = `rinkuzu_analytics_once_${storageKey}`;
  if (window.localStorage.getItem(key) === '1') return;

  captureAnalyticsEvent(event, properties);
  window.localStorage.setItem(key, '1');
}

export function trackAnalyticsPageView(url: string, title: string): void {
  if (getAnalyticsConsent() !== 'granted') return;
  const pagePath = new URL(url).pathname;
  const properties = {
    $current_url: url,
    page_path: pagePath,
    page_title: title,
  };

  initializeGoogleAnalytics();
  window.gtag?.('event', 'page_view', {
    page_location: url,
    page_path: pagePath,
    page_title: title,
  });
  void initializePostHog().then((client) => {
    if (client && getAnalyticsConsent() === 'granted') {
      client.capture('$pageview', properties);
    }
  });
}

export function identifyAnalyticsUser(userId: string, properties: AnalyticsProperties = {}): void {
  if (getAnalyticsConsent() !== 'granted') return;
  const sanitized = sanitizeProperties(properties);
  void initializePostHog().then((client) => {
    if (client && getAnalyticsConsent() === 'granted') client.identify(userId, sanitized);
  });
}

export function resetAnalyticsIdentity(): void {
  if (!isBrowser() || !posthogClient) return;
  posthogClient.reset();
}

export function fileSizeBucket(sizeBytes: number): string {
  const sizeMb = sizeBytes / (1024 * 1024);
  if (sizeMb <= 5) return '0_5_mb';
  if (sizeMb <= 15) return '6_15_mb';
  if (sizeMb <= 30) return '16_30_mb';
  return '31_50_mb';
}
