import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSubscriptionService } from '@/lib/subscriptionFactory';
import { apiErr } from '@/lib/api/response';

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
      return apiErr('config_error', 'Webhook is not configured', 500);
    }

    const body = JSON.parse(await request.text()) as {
      code?: string;
      success?: boolean;
      data?: Record<string, unknown>;
      signature?: string;
    };

    if (!body.data || !body.signature) {
      return apiErr('validation_error', 'Invalid webhook payload', 400);
    }

    if (!isValidSignature(body.data, body.signature, checksumKey)) {
      return apiErr('validation_error', 'Invalid signature', 400);
    }

    if (body.success !== true || body.code !== '00') {
      return NextResponse.json({ success: true, message: 'Webhook ignored' });
    }

    const orderCode = Number(body.data['orderCode']);
    if (!Number.isSafeInteger(orderCode) || orderCode <= 0) {
      return apiErr('validation_error', 'Invalid order code', 400);
    }

    const subscriptionService = createSubscriptionService();
    await subscriptionService.activateVerifiedSubscription(orderCode, {
      orderCode: body.data['orderCode'] as string | number,
      amount: body.data['amount'] as string | number,
      reference: body.data['reference'] as string | undefined,
      code: body.data['code'] as string | undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PayOS webhook error:', error);
    return apiErr('internal_error', 'Webhook processing failed', 500);
  }
}
