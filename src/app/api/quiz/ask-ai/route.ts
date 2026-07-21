import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withOptionalAuth } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

// Public + authenticated dual path: guest callers may still proxy to the
// adaptive backend; rate limiting only applies once we have an authenticated user.
export const POST = withOptionalAuth(async (req, { userId, session }) => {
  const userRole = session?.user?.role;

  return proxyAdaptiveRequest(
    req,
    '/quiz/ask-ai',
    {
      ...(typeof userId === 'string' ? { userId } : {}),
      ...(userRole !== undefined ? { userRole } : {}),
    },
    {
      method: 'POST',
      llmAction: 'quiz_ask_ai',
      timeoutMs: 180_000,
    },
  );
});
