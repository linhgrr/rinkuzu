import 'server-only';
import { BillingDomainError } from './billing-domain';

function enabled(name: string, productionDefault = false): boolean {
  const value = process.env[name];
  if (value === undefined) return process.env.NODE_ENV === 'production' ? productionDefault : true;
  return value.trim().toLowerCase() === 'true';
}

export type SigningKey = { kid: string; secret: string };

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
  siteUrl: () => process.env['AUTH_URL'] ?? process.env['NEXT_PUBLIC_SITE_URL'] ?? '',
};
