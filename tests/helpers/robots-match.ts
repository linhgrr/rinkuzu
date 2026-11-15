import type { MetadataRoute } from 'next';

type RobotsRule = Extract<MetadataRoute.Robots['rules'], unknown[]>[number];

function asList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/**
 * Google's robots.txt precedence (RFC 9309 + Google docs): the longest
 * matching pattern wins, and `Allow` wins a tie. `pathAndQuery` is the URL
 * path plus its query string, as a crawler compares it.
 */
export function isAllowedByRule(rule: RobotsRule, pathAndQuery: string): boolean {
  let best: { length: number; allow: boolean } | null = null;
  const candidates = [
    ...asList(rule.allow).map((pattern) => ({ pattern, allow: true })),
    ...asList(rule.disallow).map((pattern) => ({ pattern, allow: false })),
  ];
  for (const { pattern, allow } of candidates) {
    if (!pattern || !patternToRegExp(pattern).test(pathAndQuery)) continue;
    const length = pattern.length;
    if (!best || length > best.length || (length === best.length && allow)) {
      best = { length, allow };
    }
  }
  return best?.allow ?? true;
}

export function robotsRuleFor(robots: MetadataRoute.Robots, userAgent: string): RobotsRule {
  const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
  const rule = rules.find((candidate) => asList(candidate.userAgent).includes(userAgent));
  if (!rule) throw new Error(`no robots group for ${userAgent}`);
  return rule;
}
