import process from 'node:process';
import 'dotenv/config';

/**
 * Billing has two independent switches: one lets the app take money
 * (PAYOS_CREATE_ENABLED) and one lets it hand out Premium
 * (ENTITLEMENT_AUTO_ACTIVATION_ENABLED). Both default to OFF in production when
 * unset, so a deploy that sets only the first collects payments and grants
 * nothing. This gate makes that combination impossible to ship.
 *
 * Checks are graduated: with payments off only warnings are emitted, so preview
 * deploys without provider credentials still build. Turning payments on
 * promotes every check to a hard failure.
 */

const errors = [];
const warnings = [];

function enabled(name) {
  return process.env[name]?.trim().toLowerCase() === 'true';
}

function present(name) {
  return Boolean(process.env[name]?.trim());
}

const paymentsEnabled = enabled('PAYOS_CREATE_ENABLED');
const activationEnabled = enabled('ENTITLEMENT_AUTO_ACTIVATION_ENABLED');

// The failure this whole script exists to prevent.
if (paymentsEnabled && !activationEnabled) {
  errors.push(
    'PAYOS_CREATE_ENABLED is true but ENTITLEMENT_AUTO_ACTIVATION_ENABLED is not: ' +
      'orders would be paid and left unfulfilled. Set ENTITLEMENT_AUTO_ACTIVATION_ENABLED=true.',
  );
}
if (!paymentsEnabled) {
  warnings.push('PAYOS_CREATE_ENABLED is not true: checkout will refuse to create payments.');
}

// Recording a refund or chargeback is the only thing that claws Premium back.
// Leaving it unset means money can leave while access stays — the mirror image
// of collecting without granting. Manual clawback is a legitimate choice, but
// it has to be a stated one, so the variable must be present either way.
if (paymentsEnabled && !present('EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED')) {
  errors.push(
    'PAYOS_CREATE_ENABLED is true but EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED is unset: ' +
      'recorded refunds and chargebacks would leave Premium active. Set it to true, or set it ' +
      'to false to state that clawback is handled manually.',
  );
}
if (paymentsEnabled && present('EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED')) {
  if (!enabled('EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED')) {
    warnings.push(
      'EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED is false: recording a refund or chargeback will ' +
        'not revoke Premium. Revoke it from /admin/subscriptions by hand.',
    );
  }
}

const requiredWhenLive = [
  'PAYOS_CLIENT_ID',
  'PAYOS_API_KEY',
  'PAYOS_CHECKSUM_KEY',
  'BILLING_QUOTE_SIGNING_KEYS',
  'BILLING_INTERNAL_HMAC_SECRET',
  'BILLING_TERMS_VERSION',
];
for (const name of requiredWhenLive) {
  if (present(name)) continue;
  const message = `${name} is not set.`;
  if (paymentsEnabled) errors.push(message);
  else warnings.push(message);
}

if (!present('AUTH_URL') && !present('NEXT_PUBLIC_SITE_URL')) {
  const message =
    'Neither AUTH_URL nor NEXT_PUBLIC_SITE_URL is set: provider return URLs cannot be built.';
  if (paymentsEnabled) errors.push(message);
  else warnings.push(message);
}

function assertLongSecret(name, minimum = 32) {
  const value = process.env[name]?.trim();
  if (!value) return;
  if (value.length < minimum) {
    errors.push(`${name} must be at least ${minimum} characters.`);
  }
}

// The scheduler signs with this exact secret; a short one is rejected at runtime.
assertLongSecret('BILLING_INTERNAL_HMAC_SECRET');
assertLongSecret('ABUSE_SIGNAL_HASH_SECRET');

const encodedQuoteKeys = process.env.BILLING_QUOTE_SIGNING_KEYS?.trim();
if (encodedQuoteKeys) {
  let parsed;
  try {
    parsed = JSON.parse(encodedQuoteKeys);
  } catch {
    errors.push('BILLING_QUOTE_SIGNING_KEYS is not valid JSON.');
  }
  if (parsed !== undefined) {
    const valid =
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.kid === 'string' &&
          item.kid.length > 0 &&
          typeof item.secret === 'string' &&
          item.secret.length >= 32,
      );
    if (!valid) {
      errors.push(
        'BILLING_QUOTE_SIGNING_KEYS must be a non-empty array of ' +
          '{ kid: string, secret: string (>= 32 chars) }.',
      );
    } else if (parsed.some((item) => item.secret.includes('replace-with'))) {
      errors.push('BILLING_QUOTE_SIGNING_KEYS still contains the placeholder secret.');
    }
  }
}

// The scheduler runs on Cloudflare, whose egress address is not stable. An IP
// allowlist here silently 403s every cron tick.
if (present('BILLING_INTERNAL_ALLOWED_IPS')) {
  warnings.push(
    'BILLING_INTERNAL_ALLOWED_IPS is set: the Cloudflare billing scheduler has no stable ' +
      'egress IP, so every scheduled drain will be rejected with 403 unless this list ' +
      'covers it. Leave it empty unless the scheduler runs from fixed addresses.',
  );
}

for (const warning of warnings) {
  console.warn(`[billing] warning: ${warning}`);
}

if (errors.length) {
  for (const error of errors) {
    console.error(`[billing] error: ${error}`);
  }
  console.error(`Billing infrastructure validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  paymentsEnabled
    ? '[billing] configuration is complete and payments are enabled.'
    : '[billing] configuration validated (payments disabled).',
);
