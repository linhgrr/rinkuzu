import 'server-only';
import { BillingDomainError } from './billing-domain';
import {
  clampUnsupportedRetentionDays,
  UNSUPPORTED_RETENTION_DAYS_DEFAULT,
} from './domain/webhook-diagnostics';

function enabled(name: string, productionDefault = false): boolean {
  const value = process.env[name];
  if (value === undefined) return process.env.NODE_ENV === 'production' ? productionDefault : true;
  return value.trim().toLowerCase() === 'true';
}

export type SigningKey = { kid: string; secret: string };

function isSigningKey(item: unknown, minimumSecretLength: number): boolean {
  if (typeof item !== 'object' || item === null) return false;
  const record = item as Record<string, unknown>;
  return (
    typeof record['kid'] === 'string' &&
    record['kid'].length > 0 &&
    typeof record['secret'] === 'string' &&
    record['secret'].length >= minimumSecretLength
  );
}

/**
 * A versioned key list, used wherever a secret has to be rotatable without a
 * window in which one of the two sides is already using a key the other has
 * not learned yet. Unset is not an error here: the caller decides whether a
 * missing key list is fatal or simply means the feature is off.
 */
function parseKeyList(name: string, minimumSecretLength: number): SigningKey[] {
  const encoded = process.env[name]?.trim();
  if (!encoded) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    throw new BillingDomainError('billing_configuration_error', `${name} is not valid JSON`, 500);
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    !parsed.every((item) => isSigningKey(item, minimumSecretLength))
  ) {
    throw new BillingDomainError(
      'billing_configuration_error',
      `${name} must be a non-empty array of { kid, secret }`,
      500,
    );
  }
  return parsed as SigningKey[];
}

/**
 * The PayOS checksum key.
 *
 * One key, used to sign outbound requests and to verify inbound webhooks. PayOS
 * issues a single checksum key per merchant and offers no overlap window, so a
 * versioned list here bought nothing real and cost a second place for the two
 * sides of the signature to disagree. Null means the provider is not
 * configured, which the caller reports rather than treating as "verified".
 */
function parseChecksumKey(): string | null {
  const key = process.env['PAYOS_CHECKSUM_KEY']?.trim();
  return key ? key : null;
}

function parseSigningKeys(): SigningKey[] {
  const encoded = process.env['BILLING_QUOTE_SIGNING_KEYS'];
  if (encoded) {
    const parsed: unknown = JSON.parse(encoded);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>)['kid'] === 'string' &&
          typeof (item as Record<string, unknown>)['secret'] === 'string' &&
          ((item as Record<string, unknown>)['secret'] as string).length >= 32,
      )
    ) {
      return parsed as SigningKey[];
    }
    throw new BillingDomainError(
      'billing_configuration_error',
      'BILLING_QUOTE_SIGNING_KEYS is invalid',
      500,
    );
  }

  const fallback = process.env['AUTH_SECRET'];
  if (process.env.NODE_ENV !== 'production' && fallback && fallback.length >= 32) {
    return [{ kid: 'development', secret: fallback }];
  }
  throw new BillingDomainError(
    'billing_configuration_error',
    'Billing quote signing keys are not configured',
    500,
  );
}

export const billingConfig = {
  payosCreateEnabled: () => enabled('PAYOS_CREATE_ENABLED'),
  entitlementAutoActivationEnabled: () => enabled('ENTITLEMENT_AUTO_ACTIVATION_ENABLED'),
  externalRefundAutoRevocationEnabled: () => enabled('EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED'),
  providerAccountId: () =>
    process.env['PAYOS_PROVIDER_ACCOUNT_ID'] ?? process.env['PAYOS_CLIENT_ID'] ?? '',
  providerEnvironment: (): 'test' | 'production' =>
    process.env.NODE_ENV === 'production' ? 'production' : 'test',
  termsVersion: () => process.env['BILLING_TERMS_VERSION'] ?? '2026-07-23',
  quoteKeys: parseSigningKeys,
  /**
   * The one PayOS checksum key, for outbound signing and inbound verification
   * alike. Null when the provider is not configured.
   */
  payosChecksumKey: parseChecksumKey,
  /** Keys that seal retained webhook bodies; empty means keep no body at all. */
  webhookPayloadKeys: (): SigningKey[] => parseKeyList('BILLING_WEBHOOK_PAYLOAD_KEYS', 32),
  /**
   * The secret that keys the abuse hashes. Required wherever live payment
   * traffic is accepted: without it the webhook door has no per-source budget
   * and no payer signal, and both used to fail silently to "off".
   */
  abuseSignalSecret: (): string | null => {
    const secret = process.env['ABUSE_SIGNAL_HASH_SECRET']?.trim();
    return secret && secret.length >= 32 ? secret : null;
  },
  abuseSignalKeyVersion: (): string => process.env['ABUSE_SIGNAL_HASH_KEY_VERSION'] ?? 'v1',
  webhookUnsupportedRetentionDays: (): number =>
    clampUnsupportedRetentionDays(
      Number(
        process.env['BILLING_WEBHOOK_UNSUPPORTED_RETENTION_DAYS'] ??
          UNSUPPORTED_RETENTION_DAYS_DEFAULT,
      ),
    ),
  siteUrl: () => process.env['AUTH_URL'] ?? process.env['NEXT_PUBLIC_SITE_URL'] ?? '',
};
