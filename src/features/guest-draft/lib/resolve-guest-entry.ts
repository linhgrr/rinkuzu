import { GUEST_DRAFT_ENTRIES, type GuestDraftEntry } from '@/shared/constants/guest-draft';

/** Search engines whose referrer marks an organic visit (`entry=seo`, RIN-1497). */
const SEARCH_ENGINE_HOST = /(^|\.)(google|bing|duckduckgo|coccoc|yahoo|yandex|ecosia|baidu)\./;

/** A known `?entry=` value, or `undefined` so the browser can resolve it from the referrer. */
export function knownGuestDraftEntry(
  value: string | string[] | undefined,
): GuestDraftEntry | undefined {
  return GUEST_DRAFT_ENTRIES.find((entry) => entry === value);
}

function isSearchEngineReferrer(referrer: string): boolean {
  if (!URL.canParse(referrer)) return false;
  return SEARCH_ENGINE_HOST.test(new URL(referrer).hostname);
}

/**
 * Where a guest started, carried on the guest_draft_* events: the `?entry=` param when it is
 * a known entry, else `seo` for a search engine referrer, else `landing`.
 */
export function resolveGuestDraftEntry(
  param: GuestDraftEntry | undefined,
  referrer: string,
): GuestDraftEntry {
  if (param) return param;
  return isSearchEngineReferrer(referrer) ? 'seo' : 'landing';
}
