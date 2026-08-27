import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isStateChangingApiRequest } from '@/lib/security/csrf-policy';

const API_ROOT = path.join(process.cwd(), 'src/app/api');

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

/** `src/app/api/internal/billing/process/route.ts` → `/api/internal/billing/process` */
function pathnameFor(file: string): string {
  const relative = path.relative(API_ROOT, path.dirname(file)).split(path.sep).join('/');
  return `/api/${relative}`;
}

/** Guards that prove a route authenticates its own caller without a session. */
const SELF_AUTHENTICATING_GUARDS = ['assertInternalBillingRequest', 'parseAndVerifyPayOSWebhook'];

describe('self-authenticating API routes and the proxy same-origin guard', () => {
  const selfAuthenticating = routeFiles(API_ROOT)
    .filter((file) => {
      const source = readFileSync(file, 'utf8');
      return SELF_AUTHENTICATING_GUARDS.some((guard) => source.includes(guard));
    })
    .map(pathnameFor)
    .sort();

  it('finds the routes that carry their own request authenticity check', () => {
    // A guard rename that silently matches nothing would make this suite vacuous.
    expect(selfAuthenticating.length).toBeGreaterThan(0);
    expect(selfAuthenticating).toContain('/api/internal/billing/process');
    expect(selfAuthenticating).toContain('/api/internal/billing/reconcile');
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
