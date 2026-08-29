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

/**
 * Parses a versioned key list the way the runtime does and reports what is
 * wrong with it, rather than letting the first webhook of the day be the thing
 * that discovers it. Returns null when the variable is unset.
 */
function readKeyList(name, minimumSecretLength) {
  const encoded = process.env[name]?.trim();
  if (!encoded) return null;
  let parsed;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    errors.push(`${name} is not valid JSON.`);
    return [];
  }
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
        item.secret.length >= minimumSecretLength,
    );
  if (!valid) {
    errors.push(
      `${name} must be a non-empty array of ` +
        `{ kid: string, secret: string (>= ${minimumSecretLength} chars) }.`,
    );
    return [];
  }
  const kids = parsed.map((item) => item.kid);
  if (new Set(kids).size !== kids.length) {
    // A record names the key that sealed or signed it by `kid`. Two keys under
    // one name means the lookup is a coin toss.
    errors.push(`${name} contains duplicate kid values: every key version must be unique.`);
  }
  if (parsed.some((item) => item.secret.includes('replace-with'))) {
    errors.push(`${name} still contains the placeholder secret.`);
  }
  return parsed;
}

// Inbound webhook verification. Every rejected delivery leaves a row behind
// rather than a silent 4xx, but a checksum key the provider no longer signs
// with turns the whole endpoint into a wall of unauthenticated diagnostics and
// money stops moving. PayOS issues one checksum key per merchant with no
// overlap window, so there is one key here and it signs outbound requests as
// well as verifying inbound ones.
const checksumKey = process.env['PAYOS_CHECKSUM_KEY']?.trim() ?? '';
if (checksumKey && checksumKey.length < 16) {
  errors.push(
    'PAYOS_CHECKSUM_KEY is shorter than 16 characters. Copy the key verbatim from the PayOS ' +
      'dashboard rather than truncating it.',
  );
}
if (process.env['PAYOS_CHECKSUM_KEYS'] !== undefined) {
  errors.push(
    'PAYOS_CHECKSUM_KEYS is set but no longer read. One key signs and verifies; remove the ' +
      'variable so a stale rotation list cannot be mistaken for the key in force.',
  );
}

// Abuse hashing. Without a secret the webhook door has no per-source budget and
// no payer signal, and both used to fail silently to "off".
const abuseSecret = process.env['ABUSE_SIGNAL_HASH_SECRET']?.trim() ?? '';
if (abuseSecret.length < 32) {
  const message =
    'ABUSE_SIGNAL_HASH_SECRET is missing or shorter than 32 characters. Live webhook and ' +
    'payment traffic needs it: it keys the per-source rate-limit bucket and the payer signal.';
  if (paymentsEnabled) errors.push(message);
  else warnings.push(message);
}

// The operator alert channel. An installation with no channel is supported —
// alerts are still raised, still deduplicated, and now stay queued until a
// channel appears — but nobody is told, and a queue that only reports to itself
// is how a paid-but-unfulfilled order goes unnoticed. Enabled payments make it
// an error: taking money with no way to report that fulfilment stopped is not a
// configuration anyone chooses on purpose.
const alertRecipient = process.env['BILLING_ALERT_EMAIL']?.trim() ?? '';
const alertSender = process.env['MAIL_FROM']?.trim() ?? '';
if (!alertRecipient || !alertSender) {
  const missing = !alertRecipient ? 'BILLING_ALERT_EMAIL' : 'MAIL_FROM';
  const message =
    `${missing} is not set: billing alerts will be raised and queued but never delivered. ` +
    'They stay pending and go out once the channel is configured, so nothing is lost — but ' +
    'until then no one is told that money was taken and nothing was granted.';
  if (paymentsEnabled) errors.push(message);
  else warnings.push(message);
}

// Retained webhook bodies. Empty is a legitimate configuration — it means keep
// no body at all — so an unset list is a warning, never an error.
const payloadKeys = readKeyList('BILLING_WEBHOOK_PAYLOAD_KEYS', 32);
if (payloadKeys === null) {
  warnings.push(
    'BILLING_WEBHOOK_PAYLOAD_KEYS is not set: a signature-valid webhook whose schema we cannot ' +
      'read will be recorded without its body, and the parser bug it exists to explain has to ' +
      'be diagnosed from a hash alone.',
  );
} else if (payloadKeys.length === 1) {
  warnings.push(
    'BILLING_WEBHOOK_PAYLOAD_KEYS holds one key: rows sealed under a previous key are already ' +
      'unreadable. Keep a retired key listed until every row it sealed has aged out.',
  );
}
if (checksumKey && payloadKeys?.some((payload) => payload.secret === checksumKey)) {
  // Signing and encryption must not share key material: a leaked payload key
  // would then also forge webhooks.
  errors.push(
    'PAYOS_CHECKSUM_KEY also appears in BILLING_WEBHOOK_PAYLOAD_KEYS. Verification and payload ' +
      'encryption must use separate key material.',
  );
}

const retentionDays = process.env['BILLING_WEBHOOK_UNSUPPORTED_RETENTION_DAYS']?.trim();
if (retentionDays !== undefined && retentionDays !== '') {
  const parsedDays = Number(retentionDays);
  if (!Number.isFinite(parsedDays) || parsedDays < 1 || parsedDays > 90) {
    // The runtime clamps rather than throws, so an out-of-range value silently
    // means something other than what was written down.
    warnings.push(
      `BILLING_WEBHOOK_UNSUPPORTED_RETENTION_DAYS=${retentionDays} is outside the supported ` +
        'range of 1-90 days and will be clamped at runtime.',
    );
  }
}

// Environment isolation. The provider account id partitions every unique index
// in the billing collections, so test and production traffic sharing one id
// means a test webhook can collide with a live order.
if (paymentsEnabled && process.env.NODE_ENV === 'production') {
  const databaseName = (() => {
    const uri = process.env['MONGODB_URI']?.trim();
    if (!uri) return '';
    try {
      return decodeURIComponent(new URL(uri).pathname.slice(1));
    } catch {
      return '';
    }
  })();
  if (/(^|[-_])(test|ci|dev|staging|local)($|[-_])/i.test(databaseName)) {
    errors.push(
      `Payments are enabled in production against database "${databaseName}", whose name marks ` +
        'it as a non-production environment. Refusing to treat this as a live configuration.',
    );
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
