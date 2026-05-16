import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

type TokenPair = {
  raw: string;
  hash: string;
};

export function createSecureToken(byteLength = 32): TokenPair {
  const buf = randomBytes(byteLength);
  const raw = buf.toString('base64url');
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * True if a token with `expiresAt` was issued less than `minIntervalMs` ago,
 * i.e. its remaining lifetime exceeds `ttlMs - minIntervalMs`.
 */
export function wasIssuedRecently(
  expiresAt: Date | null | undefined,
  ttlMs: number,
  minIntervalMs: number,
): boolean {
  if (!expiresAt) return false;
  const remaining = expiresAt.getTime() - Date.now();
  return remaining > 0 && remaining > ttlMs - minIntervalMs;
}
