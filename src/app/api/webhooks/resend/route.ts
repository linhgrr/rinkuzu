import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { apiErr, apiOk } from '@/lib/api/response';
import { communicationHttpError } from '@/lib/communication/http';
import { processResendWebhook } from '@/lib/communication/worker';
import { verifyResendWebhook } from '@/lib/communication/resend';

export async function POST(request: NextRequest): Promise<Response> {
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  if (!id || !timestamp || !signature) {
    return apiErr('invalid_webhook_signature', 'Missing Resend webhook signature headers', 401);
  }
  const rawBody = await request.text();
  let event;
  try {
    event = verifyResendWebhook({ payload: rawBody, id, timestamp, signature });
  } catch {
    return apiErr('invalid_webhook_signature', 'Invalid Resend webhook signature', 401);
  }
  try {
    const payloadDigest = createHash('sha256').update(rawBody).digest('hex');
    return apiOk(await processResendWebhook(id, payloadDigest, event));
  } catch (error) {
    return communicationHttpError(error, 'resend-webhook');
  }
}
