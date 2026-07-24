import crypto from 'node:crypto';
import { isIP } from 'node:net';

const DEVICE_VERSION = 'v1';
const MAX_DEVICE_COOKIE_LENGTH = 256;

export interface AbuseHashKey {
  version: string;
  secret: string;
}

export interface VersionedSignalHash {
  keyVersion: string;
  hash: string;
}

export interface VerifiedDeviceCookie {
  valid: boolean;
  randomId?: string;
}

export interface ActiveRiskReason {
  weight: number;
  validUntil: Date;
}

function mac(secret: string, value: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export function issueDeviceCookie(secret: string): string {
  const randomId = crypto.randomBytes(24).toString('base64url');
  const payload = `${DEVICE_VERSION}.${randomId}`;
  return `${payload}.${mac(secret, payload)}`;
}

export function verifyDeviceCookie(value: string, secret: string): VerifiedDeviceCookie {
  if (!value || value.length > MAX_DEVICE_COOKIE_LENGTH) return { valid: false };
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== DEVICE_VERSION || !parts[1] || !parts[2]) {
    return { valid: false };
  }
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(mac(secret, payload));
  const received = Buffer.from(parts[2]);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return { valid: false };
  }
  return { valid: true, randomId: parts[1] };
}

export function hashSignalAcrossKeys(
  normalizedIdentity: string,
  keys: readonly AbuseHashKey[],
): VersionedSignalHash[] {
  return keys.map((key) => ({
    keyVersion: key.version,
    hash: mac(key.secret, normalizedIdentity),
  }));
}

export function normalizeNetworkAddress(address: string): string | null {
  const trimmed = address.trim().toLowerCase();
  const ipv4Mapped = trimmed.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/u);
  const normalized = ipv4Mapped?.[1] ?? trimmed;
  return isIP(normalized) ? normalized : null;
}

export function activeRiskScore(reasons: readonly ActiveRiskReason[], now: Date): number {
  return Math.min(
    100,
    reasons
      .filter((reason) => reason.validUntil.getTime() > now.getTime())
      .reduce((total, reason) => total + reason.weight, 0),
  );
}
