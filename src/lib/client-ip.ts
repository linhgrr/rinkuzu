import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
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
 * @public Unit-tested directly. The visitor address forwarded by the Cloudflare edge Worker, or null.
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

const CLOUDFLARE_IP_HEADER = 'cf-connecting-ip';
const FORWARDED_FOR_HEADER = 'x-forwarded-for';

function validAddress(value: string | null | undefined): string | null {
  const address = value?.trim();
  return address && isIP(address) !== 0 ? address : null;
}

/**
 * `x-real-ip` is a client-controllable header behind cloudflared (it passes
 * through unchanged), so it is read only when the platform is declared to set
 * it: `CLIENT_IP_HEADER=x-real-ip` (Vercel, until the move off it is done).
 */
function platformDeclaredHeader(): boolean {
  return process.env['CLIENT_IP_HEADER']?.trim().toLowerCase() === 'x-real-ip';
}

function platformDeclaredIp(headers: Headers): string | null {
  if (!platformDeclaredHeader()) return null;
  return validAddress(headers.get('x-real-ip'));
}

/**
 * The one place that decides the caller's address, in trust order: the edge
 * Worker's secret-authenticated header, then either the platform `x-real-ip`
 * when `CLIENT_IP_HEADER=x-real-ip` (it replaces `cf-connecting-ip`, which is
 * forgeable on Vercel) or, when unset, Cloudflare's `cf-connecting-ip`
 * (cloudflared overwrites it), then the first `x-forwarded-for` hop. Null when none holds a valid address.
 */
export function resolveClientIp(headers: Headers): string | null {
  return (
    trustedPlatformIp(headers) ?? validAddress(headers.get(FORWARDED_FOR_HEADER)?.split(',')[0])
  );
}

/** Like `resolveClientIp` but never `x-forwarded-for`: for allow-lists, which need an unforgeable address. */
export function trustedPlatformIp(headers: Headers): string | null {
  const edge = trustedEdgeClientIp(headers);
  if (edge) return edge;
  // `CLIENT_IP_HEADER` names the one trusted platform header. It replaces
  // `cf-connecting-ip`, which a caller can forge on Vercel (passed through).
  if (platformDeclaredHeader()) return platformDeclaredIp(headers);
  return validAddress(headers.get(CLOUDFLARE_IP_HEADER));
}

/**
 * A limiter key for an address. A request with no trusted address gets a key of
 * its own, so it never lands in a bucket shared by every unattributed caller
 * (one heavy user would exhaust it for all); global caps still apply to it.
 */
export function ipBucketKey(ip: string | null | undefined): string {
  return ip?.trim() || `unattributed:${randomUUID()}`;
}

const NO_COUNTRY_CODES = new Set(['XX', 'T1']);

/** The visitor country from Vercel's or Cloudflare's header: alpha-2, else null (`XX`/`T1` = unknown). */
export function resolveClientCountry(headers: Headers): string | null {
  for (const name of ['x-vercel-ip-country', 'cf-ipcountry']) {
    const value = headers.get(name)?.trim();
    if (value && /^[A-Z]{2}$/.test(value) && !NO_COUNTRY_CODES.has(value)) return value;
  }
  return null;
}
