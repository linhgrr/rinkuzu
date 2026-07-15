import crypto from 'crypto';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { NextRequest } from 'next/server';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { payosWebhookRequestSchema } from '@/dtos/subscription';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function buildPayOSSignaturePayload(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key] ?? ''}`)
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

    if (success !== true || code !== '00') {
      return apiOk(null, 200, { meta: { message: 'Webhook ignored' } });
    }

    const rawOrderCode = data.orderCode;
    const rawAmount = data.amount;
    const orderCode = Number(rawOrderCode);
    if (!Number.isSafeInteger(orderCode) || orderCode <= 0) {
      return apiErr('validation_error', 'Invalid order code', 400);
    }
    if (rawOrderCode === undefined || rawAmount === undefined) {
      return apiErr('validation_error', 'Invalid payment amount', 400);
    }

    const subscriptionService = createSubscriptionService();
    await subscriptionService.activateVerifiedSubscription(orderCode, {
      orderCode: rawOrderCode,
      amount: rawAmount,
      ...(data.reference !== undefined ? { reference: data.reference } : {}),
      ...(data.code !== undefined ? { code: data.code } : {}),
    });

    return apiOk(null);
  } catch (error) {
    logger.error({ error }, 'PayOS webhook error');
    return apiErr('internal_error', 'Webhook processing failed', 500);
  }
}
