'use client';

const ANALYTICS_CONSENT_STORAGE_KEY = 'rinkuzu_analytics_consent_v1';
const ANALYTICS_CONSENT_CHANGE_EVENT = 'rinkuzu:analytics-consent-change';
const LANDING_ATTRIBUTION_STORAGE_KEY = 'rinkuzu_landing_attribution_v1';
const CAMPAIGN_VALUE_PATTERN = /^[a-zA-Z0-9._~-]{1,100}$/;
const PENDING_LOGIN_STORAGE_KEY = 'rinkuzu_analytics_pending_login_v1';

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
export type AnalyticsLoginMethod = 'credentials' | 'google';

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

type LandingAttribution = {
  landing_id: string;
  landing_path: string;
  landing_referrer_class: 'direct' | 'internal' | 'search' | 'social' | 'referral';
  landing_at: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
};

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

function normalizeLandingPath(pathname: string): string {
  const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  return normalized || '/';
}

function campaignValue(searchParams: URLSearchParams, key: string): string | undefined {
  const value = searchParams.get(key)?.trim();
  return value && CAMPAIGN_VALUE_PATTERN.test(value) ? value : undefined;
}

function classifyReferrer(
  referrer: string,
  currentHost: string,
): LandingAttribution['landing_referrer_class'] {
  if (!referrer) return 'direct';

  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host === currentHost.toLowerCase()) return 'internal';
    if (/(^|\.)(google|bing|yahoo|duckduckgo|ecosia)\./.test(host)) return 'search';
    if (/(^|\.)(facebook|instagram|linkedin|threads|tiktok|twitter|x)\.com$/.test(host)) {
      return 'social';
    }
  } catch {
    return 'direct';
  }

  return 'referral';
}

function isLandingReferrerClass(
  value: unknown,
): value is LandingAttribution['landing_referrer_class'] {
  return (
    value === 'direct' ||
    value === 'internal' ||
    value === 'search' ||
    value === 'social' ||
    value === 'referral'
  );
}

function readLandingAttribution(): LandingAttribution | null {
  if (!isBrowser() || getAnalyticsConsent() !== 'granted') return null;
  const stored = window.localStorage.getItem(LANDING_ATTRIBUTION_STORAGE_KEY);
  if (!stored) return null;

  try {
    const value = JSON.parse(stored) as Partial<LandingAttribution>;
    if (
      typeof value.landing_id !== 'string' ||
      typeof value.landing_path !== 'string' ||
      !isLandingReferrerClass(value.landing_referrer_class) ||
      typeof value.landing_at !== 'string' ||
      !Object.values({
        utm_source: value.utm_source,
        utm_medium: value.utm_medium,
        utm_campaign: value.utm_campaign,
        utm_content: value.utm_content,
      }).every((campaign) => campaign === undefined || CAMPAIGN_VALUE_PATTERN.test(campaign))
    ) {
      return null;
    }
    return {
      landing_id: value.landing_id,
      landing_path: value.landing_path,
      landing_referrer_class: value.landing_referrer_class,
      landing_at: value.landing_at,
      ...(value.utm_source ? { utm_source: value.utm_source } : {}),
      ...(value.utm_medium ? { utm_medium: value.utm_medium } : {}),
      ...(value.utm_campaign ? { utm_campaign: value.utm_campaign } : {}),
      ...(value.utm_content ? { utm_content: value.utm_content } : {}),
    };
  } catch {
    return null;
  }
}

function persistLandingAttribution(): LandingAttribution | null {
  const existing = readLandingAttribution();
  if (existing || !isBrowser() || getAnalyticsConsent() !== 'granted') return existing;

  const landingUrl = new URL(window.location.href);
  const attribution: LandingAttribution = {
    landing_id: window.crypto.randomUUID(),
    landing_path: normalizeLandingPath(landingUrl.pathname),
    landing_referrer_class: classifyReferrer(document.referrer, landingUrl.hostname),
    landing_at: new Date().toISOString(),
  };
  for (const key of ['source', 'medium', 'campaign', 'content'] as const) {
    const value = campaignValue(landingUrl.searchParams, `utm_${key}`);
    if (value) attribution[`utm_${key}`] = value;
  }
  window.localStorage.setItem(LANDING_ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  return attribution;
}

function attributionProperties(): AnalyticsProperties {
  return persistLandingAttribution() ?? {};
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
  persistLandingAttribution();
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
  const sanitized = sanitizeProperties({ ...properties, ...attributionProperties() });

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
  const pageUrl = new URL(url);
  const pagePath = normalizeLandingPath(pageUrl.pathname);
  const querylessUrl = `${pageUrl.origin}${pagePath}`;
  const properties = {
    ...attributionProperties(),
    $current_url: querylessUrl,
    page_path: pagePath,
    page_title: title,
  };

  initializeGoogleAnalytics();
  window.gtag?.('event', 'page_view', {
    ...attributionProperties(),
    page_location: querylessUrl,
    page_path: pagePath,
    page_title: title,
  });
  void initializePostHog().then((client) => {
    if (client && getAnalyticsConsent() === 'granted') {
      client.capture('$pageview', properties);
    }
  });
}

export async function identifyAnalyticsUser(
  userId: string,
  properties: AnalyticsProperties = {},
): Promise<void> {
  if (getAnalyticsConsent() !== 'granted') return;
  const sanitized = sanitizeProperties(properties);
  const client = await initializePostHog();
  if (client && getAnalyticsConsent() === 'granted') client.identify(userId, sanitized);
}

export function markAnalyticsLoginPending(method: AnalyticsLoginMethod, locale: string): void {
  if (!isBrowser() || getAnalyticsConsent() !== 'granted') return;
  window.sessionStorage.setItem(PENDING_LOGIN_STORAGE_KEY, JSON.stringify({ method, locale }));
}

export function capturePendingAnalyticsLogin(): void {
  if (!isBrowser() || getAnalyticsConsent() !== 'granted') return;
  const pending = window.sessionStorage.getItem(PENDING_LOGIN_STORAGE_KEY);
  if (!pending) return;

  window.sessionStorage.removeItem(PENDING_LOGIN_STORAGE_KEY);
  try {
    const parsed = JSON.parse(pending) as { method?: unknown; locale?: unknown };
    if (
      (parsed.method === 'credentials' || parsed.method === 'google') &&
      typeof parsed.locale === 'string'
    ) {
      captureAnalyticsEvent('login_completed', {
        method: parsed.method,
        locale: parsed.locale,
      });
    }
  } catch {
    // Invalid or stale client state is discarded without emitting an event.
  }
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
