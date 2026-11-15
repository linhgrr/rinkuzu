import { GUEST_DRAFT_ENTRIES, type GuestDraftEntry } from '@/shared/constants/guest-draft';

/** Search engines whose referrer marks an organic visit (`entry=seo`, RIN-1497). */
const SEARCH_ENGINE_HOST = /(^|\.)(google|bing|duckduckgo|coccoc|yahoo|yandex|ecosia|baidu)\./;

/**
 * The known `?entry=` of the page URL (`window.location.search`), or `undefined` so the caller
 * falls back (referrer, `try_text`). Read in the browser at submit time so `/try/pdf` and
 * `/try/text` stay static and cacheable (RIN-1645).
 */
export function guestDraftEntryFromSearch(search: string): GuestDraftEntry | undefined {
  const values = new URLSearchParams(search).getAll('entry');
  if (values.length !== 1) return undefined;
  return GUEST_DRAFT_ENTRIES.find((entry) => entry === values[0]);
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
