import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return proxyAdaptiveRequest(req, '/api/history/subjects');
}
