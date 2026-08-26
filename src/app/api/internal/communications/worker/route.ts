import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { apiErr, apiOk } from '@/lib/api/response';
import { communicationHttpError } from '@/lib/communication/http';
import { communicationEnvironment } from '@/lib/communication/resend';
import { runCommunicationWorker } from '@/lib/communication/service';

function authorized(request: NextRequest): boolean {
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/iu, '') ?? '';
  const expected = communicationEnvironment('CRON_SECRET');
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    if (!authorized(request)) return apiErr('unauthorized', 'Invalid worker credentials', 401);
    return apiOk(await runCommunicationWorker());
  } catch (error) {
    return communicationHttpError(error, 'communication-worker');
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  return POST(request);
}
