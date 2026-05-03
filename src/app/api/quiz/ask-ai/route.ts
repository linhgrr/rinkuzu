import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';
import { buildLlmRateLimitResponse, checkLlmRateLimit } from '@/lib/llm/rate-limit';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (userId) {
    const rateLimit = await checkLlmRateLimit(userId, 'quiz_ask_ai');
    if (!rateLimit.allowed) {
      return buildLlmRateLimitResponse(rateLimit);
    }
  }

  return proxyAdaptiveRequest(req, '/api/quiz/ask-ai', {
    method: 'POST',
    timeoutMs: 180_000,
  });
}
