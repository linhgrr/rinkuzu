import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';
import { buildLlmRateLimitResponse, checkLlmRateLimit, isAdminRole } from '@/lib/llm/rate-limit';
import { withOptionalAuth } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

// Public + authenticated dual path: anonymous callers may still proxy to the
// adaptive backend; rate limiting only applies once we have a userId.
export const POST = withOptionalAuth(async (req, { userId, session }) => {
  const userRole = session?.user?.role;
  if (userId && !isAdminRole(userRole)) {
    const rateLimit = await checkLlmRateLimit(userId, 'quiz_ask_ai');
    if (!rateLimit.allowed) {
      return buildLlmRateLimitResponse(rateLimit);
    }
  }

  return proxyAdaptiveRequest(req, '/api/quiz/ask-ai', {
    method: 'POST',
    timeoutMs: 180_000,
  });
});
