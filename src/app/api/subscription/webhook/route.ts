import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '@/lib/serviceFactory';

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
      return NextResponse.json(
        { success: false, message: 'Webhook is not configured' },
        { status: 500 },
      );
    }

    const body = JSON.parse(await request.text()) as {
      code?: string;
      success?: boolean;
      data?: Record<string, unknown>;
      signature?: string;
    };

    if (!body.data || !body.signature) {
      return NextResponse.json(
        { success: false, message: 'Invalid webhook payload' },
        { status: 400 },
      );
    }

    if (!isValidSignature(body.data, body.signature, checksumKey)) {
      return NextResponse.json({ success: false, message: 'Invalid signature' }, { status: 400 });
    }

    if (body.success !== true || body.code !== '00') {
      return NextResponse.json({ success: true, message: 'Webhook ignored' });
    }

    const orderCode = Number(body.data['orderCode']);
    if (!Number.isSafeInteger(orderCode) || orderCode <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid order code' }, { status: 400 });
    }

    const subscriptionService = ServiceFactory.createSubscriptionService();
    await subscriptionService.activateVerifiedSubscription(orderCode, {
      orderCode: body.data['orderCode'] as string | number,
      amount: body.data['amount'] as string | number,
      reference: body.data['reference'] as string | undefined,
      code: body.data['code'] as string | undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PayOS webhook error:', error);
    return NextResponse.json(
      { success: false, message: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
