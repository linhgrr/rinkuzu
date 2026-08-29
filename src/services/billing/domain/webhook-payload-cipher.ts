import crypto from 'crypto';
import type { SigningKey } from '../billing-config';

/**
 * Envelope encryption for the one webhook body we are allowed to keep.
 *
 * A signature-valid payload we could not parse is the only class worth
 * retaining: it is the evidence needed to fix the parser, and it came from the
 * provider rather than from an anonymous caller. It is still attacker-adjacent
 * text that may name a payer, so it is never stored in the clear.
 *
 * Each record gets its own derived key. The random IV doubles as the HKDF salt,
 * so two records sealed under the same configured secret never share an
 * encryption key, and a leaked derived key exposes exactly one row. The
 * configured key is identified by `keyVersion` rather than embedded, which is
 * what makes rotation a matter of prepending a new key and letting the old one
 * age out with the rows it sealed.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const HKDF_INFO = 'billing-webhook-payload/v1';

export interface SealedWebhookPayload {
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
  readonly keyVersion: string;
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', secret, salt, HKDF_INFO, KEY_BYTES));
}

/**
 * Seals a body under the newest configured key, or returns null when no key is
 * configured — which is a deliberate "retain nothing" rather than a failure, so
 * an operator can switch retention off by removing the key.
 */
export function sealWebhookPayload(
  plaintext: string,
  keys: readonly SigningKey[],
): SealedWebhookPayload | null {
  const key = keys[0];
  if (!key) return null;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(key.secret, iv), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion: key.kid,
  };
}

/**
 * Opens a sealed body, or returns null when the sealing key has been retired or
 * the record does not authenticate. Both are ordinary outcomes for a reader
 * looking at old diagnostics, so neither throws.
 */
export function openWebhookPayload(
  sealed: SealedWebhookPayload,
  keys: readonly SigningKey[],
): string | null {
  const key = keys.find((candidate) => candidate.kid === sealed.keyVersion);
  if (!key) return null;
  try {
    const iv = Buffer.from(sealed.iv, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(key.secret, iv), iv);
    decipher.setAuthTag(Buffer.from(sealed.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
