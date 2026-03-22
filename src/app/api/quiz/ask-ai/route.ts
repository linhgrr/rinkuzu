import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return proxyAdaptiveRequest(req, '/api/quiz/ask-ai', {
    method: 'POST',
  });
}
