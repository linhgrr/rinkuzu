import { resolveMx, resolveTxt } from 'node:dns/promises';
import process from 'node:process';
import 'dotenv/config';
import { Resend } from 'resend';

import {
  EMAIL_LOCAL_PART_MAX_LENGTH,
  feedbackReplyAddress,
  feedbackReplyToken,
} from './feedback-address.shared.mjs';

const required = [
  'RESEND_API_KEY',
  'SUPPORT_MAIL_FROM',
  'SUPPORT_ADMIN_EMAIL',
  'FEEDBACK_MAIL_FROM',
  'FEEDBACK_REPLY_DOMAIN',
  'MARKETING_MAIL_FROM',
  'RESEND_WEBHOOK_SECRET',
  'RESEND_PRODUCT_UPDATES_TOPIC_ID',
  'RESEND_PROMOTIONS_TOPIC_ID',
  'CRON_SECRET',
  'NEXT_PUBLIC_SITE_URL',
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Communication infrastructure is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const replyDomain = process.env.FEEDBACK_REPLY_DOMAIN.trim();
function senderDomain(value, name) {
  const match = value.match(/@([^>\s]+)>?\s*$/);
  if (!match?.[1]) {
    throw new Error(`${name} must contain a valid sender email address`);
  }
  return match[1].toLowerCase();
}

const outboundDomains = [
  senderDomain(process.env.SUPPORT_MAIL_FROM, 'SUPPORT_MAIL_FROM'),
  senderDomain(process.env.FEEDBACK_MAIL_FROM, 'FEEDBACK_MAIL_FROM'),
  senderDomain(process.env.MARKETING_MAIL_FROM, 'MARKETING_MAIL_FROM'),
];
const outboundDomainSet = new Set(outboundDomains);
const errors = [];

/**
 * Feedback replies are routed by an address of the form
 * `feedback+<token>@<FEEDBACK_REPLY_DOMAIN>`. RFC 5321 caps a local part at 64
 * octets and Resend rejects the whole send when it is longer, so a
 * representative address is built here with the same derivation the runtime
 * uses and validated before anything ships. No email is sent.
 */
{
  // A 24 hex character id is the longest conversation id Mongo can produce, so
  // it is the worst case for the derived address.
  const sampleConversationId = 'f'.repeat(24);
  try {
    // The HMAC output length does not depend on the secret, so the check stays
    // valid without pulling a runtime secret into the build environment.
    const secret = process.env.AUTH_SECRET?.trim() || 'communication-validation-placeholder';
    const token = feedbackReplyToken(sampleConversationId, secret);
    const address = feedbackReplyAddress(token, replyDomain);
    const [localPart, domainPart] = address.split('@');
    if (localPart.length > EMAIL_LOCAL_PART_MAX_LENGTH) {
      errors.push(
        `Feedback Reply-To local part is ${localPart.length} characters; the limit is ${EMAIL_LOCAL_PART_MAX_LENGTH}`,
      );
    }
    if (domainPart !== replyDomain.trim().toLowerCase()) {
      errors.push(`Feedback Reply-To domain ${domainPart} does not match FEEDBACK_REPLY_DOMAIN`);
    }
  } catch (error) {
    errors.push(
      `Feedback Reply-To generation failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
  }
}

for (const name of ['MARKETING_COMPLAINT_STOP_RATE', 'MARKETING_HARD_BOUNCE_STOP_RATE']) {
  const value = process.env[name]?.trim();
  if (!value) continue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    errors.push(`${name} must be greater than 0 and at most 1`);
  }
}

try {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const topicIds = [
    process.env.RESEND_PRODUCT_UPDATES_TOPIC_ID,
    process.env.RESEND_PROMOTIONS_TOPIC_ID,
  ];
  const listedTopics = await resend.topics.list();
  if (listedTopics.error) throw new Error(listedTopics.error.message);
  for (const topicId of topicIds) {
    const topic = listedTopics.data?.data.find((entry) => entry.id === topicId);
    if (!topic) errors.push(`Resend topic ${topicId} does not exist`);
    else if (topic.default_subscription !== 'opt_out') {
      errors.push(`Resend topic ${topicId} must default to opt_out`);
    }
  }

  const webhookEndpoint = new URL('/api/webhooks/resend', process.env.NEXT_PUBLIC_SITE_URL).href;
  const requiredWebhookEvents = [
    'email.sent',
    'email.delivered',
    'email.bounced',
    'email.complained',
    'email.suppressed',
    'email.failed',
    'email.opened',
    'email.clicked',
    'email.received',
  ];
  const listedWebhooks = await resend.webhooks.list();
  if (listedWebhooks.error) throw new Error(listedWebhooks.error.message);
  const webhook = listedWebhooks.data?.data.find(
    (entry) => entry.endpoint === webhookEndpoint && entry.status === 'enabled',
  );
  if (!webhook) {
    errors.push(`Enabled Resend webhook ${webhookEndpoint} does not exist`);
  } else {
    const configuredEvents = new Set(webhook.events ?? []);
    for (const event of requiredWebhookEvents) {
      if (!configuredEvents.has(/** @type {import('resend').WebhookEvent} */ (event))) {
        errors.push(`Resend webhook is missing ${event}`);
      }
    }
  }

  const listed = await resend.domains.list();
  if (listed.error) throw new Error(listed.error.message);
  const domains = listed.data?.data ?? [];
  for (const name of [...new Set([...outboundDomains, replyDomain])]) {
    const domain = domains.find((entry) => entry.name === name);
    if (!domain) {
      errors.push(`${name} is not configured in Resend`);
      continue;
    }
    if (domain.status !== 'verified') errors.push(`${name} is not verified in Resend`);
    const details = await resend.domains.get(domain.id);
    if (details.error) {
      errors.push(`${name} Resend verification lookup failed: ${details.error.message}`);
      continue;
    }
    if (outboundDomainSet.has(name)) {
      if (details.data?.capabilities.sending !== 'enabled') {
        errors.push(`${name} does not have Resend sending enabled`);
      }
      if (
        !details.data?.records.some(
          (record) => record.record === 'SPF' && record.status === 'verified',
        )
      ) {
        errors.push(`${name} SPF/return-path is not verified by Resend`);
      }
      if (
        !details.data?.records.some(
          (record) => record.record === 'DKIM' && record.status === 'verified',
        )
      ) {
        errors.push(`${name} DKIM is not verified by Resend`);
      }
    }
    if (name === replyDomain) {
      if (details.data?.capabilities.receiving !== 'enabled') {
        errors.push(`${name} does not have Resend Receiving enabled`);
      }
      if (
        !details.data?.records.some(
          (record) => record.record === 'Receiving' && record.status === 'verified',
        )
      ) {
        errors.push(`${name} Receiving MX is not verified by Resend`);
      }
    }
  }
} catch (error) {
  errors.push(
    `Resend domain validation failed: ${error instanceof Error ? error.message : 'unknown'}`,
  );
}

try {
  const mx = await resolveMx(replyDomain);
  if (
    !mx.some((record) => /^inbound-smtp\.[a-z0-9-]+\.amazonaws\.com\.?$/i.test(record.exchange))
  ) {
    errors.push(`${replyDomain} MX does not point to Resend`);
  }
} catch (error) {
  errors.push(
    `${replyDomain} MX lookup failed: ${error instanceof Error ? error.message : 'unknown'}`,
  );
}

for (const domain of outboundDomains) {
  try {
    const dmarc = (await resolveTxt(`_dmarc.${domain}`)).flat().join(' ');
    if (!/v=DMARC1/i.test(dmarc)) errors.push(`${domain} has no DMARC record`);
  } catch (error) {
    errors.push(
      `${domain} DMARC lookup failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
  }
}

if (errors.length) {
  console.error(`Communication infrastructure validation failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log('Communication infrastructure validation passed.');
