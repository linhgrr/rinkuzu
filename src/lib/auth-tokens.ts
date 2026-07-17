import 'server-only';
import { createHash, randomBytes } from 'crypto';

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
