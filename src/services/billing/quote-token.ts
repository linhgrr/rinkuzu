import crypto from 'crypto';
import { BillingDomainError } from './billing-domain';
import type { SigningKey } from './billing-config';

export type BillingQuotePayload = {
  userId: string;
  planId: string;
  currency: 'VND';
  baseAmount: number;
  promotionId: string | null;
  promotionCode: string | null;
  discountAmount: number;
  finalAmount: number;
  durationUnit: 'day' | 'month';
  durationValue: number;
  pricingVersion: number;
  promoVersion: number | null;
  termsVersion: string;
  issuedAt: number;
  expiresAt: number;
};

function encode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function sign(input: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(input).digest('base64url');
}

export function issueQuoteToken(payload: BillingQuotePayload, key: SigningKey): string {
  const encodedPayload = encode(JSON.stringify(payload));
  const prefix = `v1.${encode(key.kid)}.${encodedPayload}`;
  return `${prefix}.${sign(prefix, key.secret)}`;
}

export function verifyQuoteToken(
  token: string,
  keys: SigningKey[],
  now = Date.now(),
): BillingQuotePayload {
  if (Buffer.byteLength(token, 'utf8') > 4_096) {
    throw new BillingDomainError('invalid_quote', 'Quote token is too large', 400);
  }
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new BillingDomainError('invalid_quote', 'Quote token is invalid', 400);
  }
  const [, encodedKid, encodedPayload, receivedMac] = parts;
  if (!encodedKid || !encodedPayload || !receivedMac) {
    throw new BillingDomainError('invalid_quote', 'Quote token is invalid', 400);
  }
  let kid: string;
  try {
    kid = Buffer.from(encodedKid, 'base64url').toString('utf8');
  } catch {
    throw new BillingDomainError('invalid_quote', 'Quote token is invalid', 400);
  }
  const key = keys.find((candidate) => candidate.kid === kid);
  if (!key) throw new BillingDomainError('invalid_quote', 'Quote signing key is not active', 409);

  const prefix = `v1.${encodedKid}.${encodedPayload}`;
  const expectedMac = sign(prefix, key.secret);
  const expected = Buffer.from(expectedMac);
  const received = Buffer.from(receivedMac);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw new BillingDomainError('invalid_quote', 'Quote token is invalid', 400);
  }

  let payload: BillingQuotePayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as BillingQuotePayload;
  } catch {
    throw new BillingDomainError('invalid_quote', 'Quote token is invalid', 400);
  }
  if (
    payload.userId === undefined ||
    payload.planId === undefined ||
    !Number.isSafeInteger(payload.issuedAt) ||
    !Number.isSafeInteger(payload.expiresAt)
  ) {
    throw new BillingDomainError('invalid_quote', 'Quote token is invalid', 400);
  }
  if (payload.expiresAt < now) {
    throw new BillingDomainError('quote_expired', 'Quote has expired', 409);
  }
  if (payload.issuedAt > now + 30_000) {
    throw new BillingDomainError('invalid_quote', 'Quote was issued in the future', 400);
  }
  return payload;
}
