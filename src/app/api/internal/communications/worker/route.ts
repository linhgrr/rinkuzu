import type { NextRequest } from 'next/server';
import { hasCronSecretBearer } from '@/lib/api/cron-secret-auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { communicationHttpError } from '@/lib/communication/http';
import { runCommunicationWorker } from '@/lib/communication/worker';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    if (!hasCronSecretBearer(request)) {
      return apiErr('unauthorized', 'Invalid worker credentials', 401);
    }
    return apiOk(await runCommunicationWorker());
  } catch (error) {
    return communicationHttpError(error, 'communication-worker');
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  return POST(request);
}
