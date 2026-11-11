import remotePatterns from './remote-patterns.json';

/**
 * One entry of `images.remotePatterns` in next.config.js. The list itself lives in
 * remote-patterns.json so the config and this check cannot drift apart (RIN-1531).
 */
interface RemoteImagePattern {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
}

const PATTERNS: readonly RemoteImagePattern[] = remotePatterns;

function matchesHostname(pattern: string, hostname: string): boolean {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return hostname.length > suffix.length && hostname.endsWith(suffix);
  }
  return pattern === hostname;
}

function matchesPathname(pattern: string, pathname: string): boolean {
  if (pattern.endsWith('/**')) {
    const base = pattern.slice(0, -3);
    return pathname === base || pathname.startsWith(`${base}/`);
  }
  return pattern === pathname;
}

function matchesPattern(pattern: RemoteImagePattern, url: URL): boolean {
  return (
    url.protocol === `${pattern.protocol}:` &&
    url.port === pattern.port &&
    matchesHostname(pattern.hostname, url.hostname) &&
    matchesPathname(pattern.pathname, url.pathname)
  );
}

/**
 * True when next/image can optimize `src`: a same-origin path, or a remote URL that
 * `images.remotePatterns` allows. Anything else must render with `unoptimized`, or the
 * optimizer rejects it ("hostname is not configured").
 */
export function canOptimizeImageSrc(src: string): boolean {
  if (src.startsWith('/')) return !src.startsWith('//');

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  return PATTERNS.some((pattern) => matchesPattern(pattern, url));
}
