import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isStateChangingApiRequest } from '@/lib/security/csrf-policy';

const SRC_ROOT = path.join(process.cwd(), 'src');
const API_ROOT = path.join(SRC_ROOT, 'app/api');

/**
 * A route that authenticates its caller with a signature instead of a session
 * is, by construction, called server-to-server — so it arrives with no Origin,
 * Referer or Sec-Fetch-Site. The proxy's same-origin guard rejects exactly that
 * shape with a 403 before the route's own guard ever runs.
 *
 * This bit the billing scheduler: both internal drains verified HMAC correctly
 * and were still unreachable in production. Nothing coupled "guards itself" to
 * "exempt from the same-origin check", so the gap was invisible until a live
 * request was tried. This test is that coupling.
 */
function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === 'route.ts' ? [full] : [];
  });
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/u.test(entry.name) ? [full] : [];
  });
}

/** `src/app/api/internal/billing/process/route.ts` → `/api/internal/billing/process` */
function pathnameFor(file: string): string {
  const relative = path.relative(API_ROOT, path.dirname(file)).split(path.sep).join('/');
  return `/api/${relative}`;
}

/**
 * What a route has to name, in its own source, to be authenticating its caller
 * without a session — either the check itself or the wrapper that applies it.
 *
 * The wrapper belongs on this list because the two internal drains share one
 * now: scanning for the check alone would find neither route and report that
 * nothing needs the exemption, while both would still be unreachable without
 * it. `parseAndVerifyPayOSWebhook` used to sit here and had matched nothing
 * since it was renamed, which is why the second test below exists.
 */
const SELF_AUTHENTICATING_GUARDS = [
  'assertInternalBillingRequest',
  'withInternalBillingTick',
  'verifyAndClassifyPayOSWebhook',
];

describe('self-authenticating API routes and the proxy same-origin guard', () => {
  const routes = routeFiles(API_ROOT).map((file) => ({
    pathname: pathnameFor(file),
    source: readFileSync(file, 'utf8'),
  }));
  const selfAuthenticating = routes
    .filter((route) => SELF_AUTHENTICATING_GUARDS.some((guard) => route.source.includes(guard)))
    .map((route) => route.pathname)
    .sort();

  it('finds the routes that carry their own request authenticity check', () => {
    // A guard rename that silently matches nothing would make this suite vacuous.
    expect(selfAuthenticating.length).toBeGreaterThan(0);
    expect(selfAuthenticating).toContain('/api/internal/billing/process');
    expect(selfAuthenticating).toContain('/api/internal/billing/reconcile');
    expect(selfAuthenticating).toContain('/api/billing/webhooks/[provider]');
  });

  it('names only guards that still exist', () => {
    // The list is the only thing between this suite and a false pass, so a name
    // that outlives the symbol it was tracking has to fail rather than shrink
    // the set of routes being checked. A guard may legitimately be applied
    // through a wrapper and so appear in no route file, but it must exist
    // somewhere.
    for (const guard of SELF_AUTHENTICATING_GUARDS) {
      expect(sourceFiles(SRC_ROOT).some((file) => readFileSync(file, 'utf8').includes(guard))).toBe(
        true,
      );
    }
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'exempts every one of them from the same-origin guard for %s',
    (method) => {
      const blocked = selfAuthenticating.filter((pathname) =>
        isStateChangingApiRequest(pathname, method),
      );
      expect(blocked).toEqual([]);
    },
  );
});
