import crypto from 'crypto';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { NextRequest } from 'next/server';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { payosWebhookRequestSchema } from '@/dtos/subscription';
import { logger } from '@/lib/logger';
import { billingConfig } from '@/services/billing/billing-config';

export const dynamic = 'force-dynamic';

function sortRecordKeys(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function toPayOSSignatureValue(value: unknown): string {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return '';
  if (Array.isArray(value)) {
    return JSON.stringify(
      value.map((item) =>
        typeof item === 'object' && item !== null && !Array.isArray(item)
          ? sortRecordKeys(item as Record<string, unknown>)
          : item,
      ),
    );
  }
  return String(value);
}

function buildPayOSSignaturePayload(data: Record<string, unknown>): string {
  return Object.keys(data)
    .filter((key) => data[key] !== undefined)
    .sort()
    .map((key) => `${key}=${toPayOSSignatureValue(data[key])}`)
    .join('&');
}

function isValidSignature(data: Record<string, unknown>, signature: string, checksumKey: string) {
  const payload = buildPayOSSignaturePayload(data);
  const expected = crypto.createHmac('sha256', checksumKey).update(payload).digest('hex');
  const receivedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return (
    receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function POST(request: NextRequest) {
  try {
    const checksumKey = process.env['PAYOS_CHECKSUM_KEY'];
    if (!checksumKey) {
      return apiErr('configuration_error', 'Webhook is not configured', 500);
    }

    const body = await readAndValidateJson(request, payosWebhookRequestSchema);
    if (!body.success) {
      return apiErr('validation_error', body.error, 400, { issues: body.fields });
    }
    const { code, success, data, signature } = body.data;

    if (!isValidSignature(data, signature, checksumKey)) {
      return apiErr('validation_error', 'Invalid signature', 400);
    }

    if (!billingConfig.entitlementAutoActivationEnabled()) {
      return apiErr('activation_paused', 'Subscription activation is temporarily paused', 503);
    }

    if (success !== true || code !== '00') {
      return apiOk(null, 200, { meta: { message: 'Webhook ignored' } });
    }

    const rawOrderCode = data.orderCode;
    const rawAmount = data.amount;
    const orderCode = Number(rawOrderCode);
    if (!Number.isSafeInteger(orderCode) || orderCode <= 0) {
      return apiErr('validation_error', 'Invalid order code', 400);
    }
    const amount = Number(rawAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return apiErr('validation_error', 'Invalid payment amount', 400);
    }
    if (typeof data.reference !== 'string' || data.reference.trim().length === 0) {
      return apiErr('validation_error', 'Invalid payment reference', 400);
    }
    if (data.code !== '00') {
      return apiErr('validation_error', 'Invalid payment code', 400);
    }

    const subscriptionService = createSubscriptionService();
    await subscriptionService.activateVerifiedSubscription(orderCode, {
      orderCode,
      amount,
      reference: data.reference,
    });

    return apiOk(null);
  } catch (error) {
    logger.error({ error }, 'PayOS webhook error');
    return apiErr('internal_error', 'Webhook processing failed', 500);
  }
}
