export type LandingReferrerClass = 'direct' | 'internal' | 'search' | 'social' | 'referral';

export function classifyReferrer(referrer: string, currentHost: string): LandingReferrerClass {
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

export function isLandingReferrerClass(value: unknown): value is LandingReferrerClass {
  return (
    value === 'direct' ||
    value === 'internal' ||
    value === 'search' ||
    value === 'social' ||
    value === 'referral'
  );
}
