'use client';

import posthog from 'posthog-js';

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

let posthogInitialized = false;
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

function initializePostHog(): void {
  if (!isBrowser() || posthogInitialized || !posthogToken) return;

  posthog.init(posthogToken, {
    api_host: posthogHost,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    person_profiles: 'identified_only',
  });
  posthogInitialized = true;
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

export function initializeAnalytics(): boolean {
  if (getAnalyticsConsent() !== 'granted') return false;
  initializePostHog();
  initializeGoogleAnalytics();
  return posthogInitialized || googleAnalyticsInitialized;
}

export function grantAnalyticsConsent(): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'granted');
  if (googleAnalyticsId) {
    Reflect.set(window, `ga-disable-${googleAnalyticsId}`, false);
  }
  if (posthogInitialized) {
    posthog.opt_in_capturing();
  }
  initializeAnalytics();
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGE_EVENT));
}

export function denyAnalyticsConsent(): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'denied');
  if (googleAnalyticsId) {
    Reflect.set(window, `ga-disable-${googleAnalyticsId}`, true);
  }
  if (posthogInitialized) {
    posthog.opt_out_capturing();
    posthog.reset();
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGE_EVENT));
}

export function captureAnalyticsEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): void {
  if (!initializeAnalytics()) return;
  const sanitized = sanitizeProperties(properties);

  if (posthogInitialized) {
    posthog.capture(event, sanitized);
  }
  window.gtag?.('event', event, sanitized);
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
  if (!initializeAnalytics()) return;
  const pagePath = new URL(url).pathname;

  if (posthogInitialized) {
    posthog.capture('$pageview', {
      $current_url: url,
      page_path: pagePath,
      page_title: title,
    });
  }
  window.gtag?.('event', 'page_view', {
    page_location: url,
    page_path: pagePath,
    page_title: title,
  });
}

export function identifyAnalyticsUser(userId: string, properties: AnalyticsProperties = {}): void {
  if (!initializeAnalytics() || !posthogInitialized) return;
  posthog.identify(userId, sanitizeProperties(properties));
}

export function resetAnalyticsIdentity(): void {
  if (!isBrowser() || !posthogInitialized) return;
  posthog.reset();
}

export function fileSizeBucket(sizeBytes: number): string {
  const sizeMb = sizeBytes / (1024 * 1024);
  if (sizeMb <= 5) return '0_5_mb';
  if (sizeMb <= 15) return '6_15_mb';
  if (sizeMb <= 30) return '16_30_mb';
  return '31_50_mb';
}
