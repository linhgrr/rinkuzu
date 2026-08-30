import { withPremiumSubmissionRead } from '@/lib/api/premium-quiz-action';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

/** A short-lived link to the author's uploaded source, for review. */
export const GET = withPremiumSubmissionRead('Get Premium source PDF failed', (id) =>
  getPremiumQuizService().getAdminSourceUrl(id),
);
