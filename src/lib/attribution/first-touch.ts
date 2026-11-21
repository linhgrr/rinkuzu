/**
 * First-touch attribution (RIN-1762). Pure helpers shared by the consent-gated
 * analytics flow (`lib/analytics/client.ts`), the consent-free capture that
 * writes the `rk_ft` cookie in the browser, and the server, which parses that
 * cookie as untrusted input when an account is created.
 */

export const FIRST_TOUCH_COOKIE = 'rk_ft';
const FIRST_TOUCH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const FIRST_TOUCH_MAX_AGE_MS = FIRST_TOUCH_MAX_AGE_SECONDS * 1000;
/** A cookie longer than this is never parsed. */
const FIRST_TOUCH_MAX_COOKIE_LENGTH = 1024;
const MAX_VALUE_LENGTH = 64;

/** Allowed characters of a campaign value as typed in a URL (RIN-1268 era pattern). */
export const CAMPAIGN_VALUE_PATTERN = /^[a-zA-Z0-9._~-]{1,100}$/;
const STORED_VALUE_PATTERN = /^[a-z0-9._~-]{1,64}$/;
const ENTRY_PATH_PATTERN = /^\/[A-Za-z0-9._~\-/%]{0,199}$/;

const REFERRER_CLASSES = ['direct', 'internal', 'search', 'social', 'referral'] as const;
export type ReferrerClass = (typeof REFERRER_CLASSES)[number];

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
type UtmKey = (typeof UTM_KEYS)[number];

export type FirstTouch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  referrer_class: ReferrerClass;
  /** Path only, never a query string. */
  entry_path: string;
  first_seen_at: string;
};

export function normalizeLandingPath(pathname: string): string {
  const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  return normalized || '/';
}

export function campaignValue(searchParams: URLSearchParams, key: string): string | undefined {
  const value = searchParams.get(key)?.trim();
  return value && CAMPAIGN_VALUE_PATTERN.test(value) ? value : undefined;
}

export function classifyReferrer(referrer: string, currentHost: string): ReferrerClass {
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

export function isReferrerClass(value: unknown): value is ReferrerClass {
  return REFERRER_CLASSES.includes(value as ReferrerClass);
}

/** Path the parser accepts: disallowed characters (`+ : @ ,` ...) are dropped, length capped. */
function safeEntryPath(pathname: string): string {
  const cleaned = normalizeLandingPath(pathname).replace(/[^A-Za-z0-9._~\-/%]/g, '');
  return ('/' + cleaned.replace(/^\/+/, '')).slice(0, 200);
}

/** @public Unit-tested directly. Builds the record for one page load: lowercased, truncated utm values, path without query. */
export function buildFirstTouch(landingUrl: URL, referrer: string, now: Date): FirstTouch {
  const touch: FirstTouch = {
    referrer_class: classifyReferrer(referrer, landingUrl.hostname),
    entry_path: safeEntryPath(landingUrl.pathname),
    first_seen_at: now.toISOString(),
  };
  for (const key of UTM_KEYS) {
    const value = campaignValue(landingUrl.searchParams, key);
    if (value) touch[key] = value.toLowerCase().slice(0, MAX_VALUE_LENGTH);
  }
  return touch;
}

/**
 * Parses the cookie value. Anything wrong (size, encoding, shape, enum,
 * pattern) is dropped, never thrown: an invalid utm field is removed, an
 * invalid class, path or timestamp discards the whole record.
 */
export function parseFirstTouch(raw: string | null | undefined, now: Date): FirstTouch | null {
  if (!raw || raw.length > FIRST_TOUCH_MAX_COOKIE_LENGTH) return null;
  let value: unknown;
  try {
    value = JSON.parse(decodeBase64Url(raw));
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const { referrer_class, entry_path, first_seen_at } = record;
  if (!isReferrerClass(referrer_class)) return null;
  if (typeof entry_path !== 'string' || !ENTRY_PATH_PATTERN.test(entry_path)) return null;
  if (typeof first_seen_at !== 'string') return null;
  const seenAt = new Date(first_seen_at);
  if (Number.isNaN(seenAt.getTime()) || seenAt.getTime() - now.getTime() > 24 * 60 * 60 * 1000) {
    return null;
  }
  const touch: FirstTouch = {
    referrer_class,
    entry_path,
    first_seen_at: seenAt.toISOString(),
  };
  for (const key of UTM_KEYS) {
    const item = record[key];
    if (typeof item === 'string' && STORED_VALUE_PATTERN.test(item)) touch[key as UtmKey] = item;
  }
  return touch;
}

/** Browser-safe base64url decode (no Node Buffer: Turbopack does not polyfill it). */
function decodeBase64Url(raw: string): string {
  const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
}

/** @public Unit-tested directly; the browser cookie encoding. */
export function encodeFirstTouch(touch: FirstTouch): string {
  return btoa(JSON.stringify(touch)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** First touch wins: replace only a missing or 7-day-old record, never one by an internal visit. */
function shouldWriteFirstTouch(
  existing: FirstTouch | null,
  incoming: FirstTouch,
  now: Date,
): boolean {
  if (!existing) return true;
  if (incoming.referrer_class === 'internal') return false;
  return now.getTime() - new Date(existing.first_seen_at).getTime() >= FIRST_TOUCH_MAX_AGE_MS;
}

function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/**
 * Browser side, no consent needed: stores the first touch in a first-party
 * cookie so the server can read it when it creates the account. Returns true
 * when it wrote.
 */
export function captureFirstTouch(
  doc: Pick<Document, 'cookie' | 'referrer'>,
  location: Pick<Location, 'href' | 'protocol'>,
  now: Date = new Date(),
): boolean {
  try {
    const incoming = buildFirstTouch(new URL(location.href), doc.referrer, now);
    const existing = parseFirstTouch(readCookie(doc.cookie, FIRST_TOUCH_COOKIE), now);
    if (!shouldWriteFirstTouch(existing, incoming, now)) return false;
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    doc.cookie = `${FIRST_TOUCH_COOKIE}=${encodeFirstTouch(incoming)}; Path=/; Max-Age=${FIRST_TOUCH_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
    return true;
  } catch {
    return false;
  }
}
