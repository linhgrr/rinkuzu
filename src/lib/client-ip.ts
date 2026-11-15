import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

/** The visitor address the edge Worker read from Cloudflare's `CF-Connecting-IP`. */
const EDGE_CLIENT_IP_HEADER = 'x-rinkuzu-client-ip';
/** The shared secret proving a request came through the edge Worker. */
const EDGE_SECRET_HEADER = 'x-rinkuzu-edge';

const MIN_EDGE_SECRET_LENGTH = 32;

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Timing-safe equality for inputs of any length: both sides are hashed first. */
function secretsMatch(received: string, expected: string): boolean {
  return timingSafeEqual(digest(received), digest(expected));
}

/**
 * The visitor address forwarded by the Cloudflare edge Worker, or null.
 *
 * Behind the Worker, Vercel sees Cloudflare's edge as the client, so the usual
 * `x-real-ip` / `x-forwarded-for` hold a Cloudflare address. The Worker sends
 * the real one in `x-rinkuzu-client-ip`, but anyone can call the deployment
 * directly and set that header, so it is trusted only when `x-rinkuzu-edge`
 * carries `EDGE_SHARED_SECRET`. With the secret unset (or shorter than 32
 * characters) the trusted path is off and every caller keeps its own previous
 * header order.
 */
export function trustedEdgeClientIp(headers: Headers): string | null {
  const expected = process.env['EDGE_SHARED_SECRET']?.trim();
  if (!expected || expected.length < MIN_EDGE_SECRET_LENGTH) return null;
  const received = headers.get(EDGE_SECRET_HEADER);
  if (!received || !secretsMatch(received, expected)) return null;
  const address = headers.get(EDGE_CLIENT_IP_HEADER)?.trim();
  return address && isIP(address) !== 0 ? address : null;
}
