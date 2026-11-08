import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { getConstraint, resolveEntitlements } from '@/lib/entitlements';
import {
  quizDraftJobLinkFromEnvelope,
  settleQuizDraftUsageFromResponse,
} from '@/lib/quiz/draft-usage';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { userId, session }) => {
  const auth = { userId, userRole: session.user.role };
  const response = await proxyAdaptiveRequest(req, '/quiz/drafts', auth);
  // Failed drafts hand their quiz_extract unit back (RIN-596).
  await settleQuizDraftUsageFromResponse(response, auth);
  return response;
});

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
      // Link the unit to the created draft so a later failed extraction refunds it.
      llmJobLink: quizDraftJobLinkFromEnvelope,
      internalHeaders: { 'x-rinkuzu-pdf-page-limit': String(maxPdfPages) },
    },
  );
});
