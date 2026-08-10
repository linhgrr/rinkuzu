import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { getConstraint, resolveEntitlements } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { userId, session }) =>
  proxyAdaptiveRequest(req, '/quiz/drafts', {
    userId,
    userRole: session.user.role,
  }),
);

export const POST = withAuth(async (req, { userId, session }) => {
  const entitlements = await resolveEntitlements(userId);
  const maxPdfPages = getConstraint(
    session.user.role === 'admin' ? { tier: 'premium' } : entitlements,
    'quiz_pdf_pages',
  );

  return proxyAdaptiveRequest(
    req,
    '/quiz/drafts',
    { userId, userRole: session.user.role },
    {
      method: 'POST',
      llmAction: 'quiz_extract',
      internalHeaders: { 'x-rinkuzu-pdf-page-limit': String(maxPdfPages) },
    },
  );
});
