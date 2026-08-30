import { withPremiumSubmissionRead } from '@/lib/api/premium-quiz-action';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export const GET = withPremiumSubmissionRead('Get Premium quiz submission failed', (id) =>
  getPremiumQuizService().getAdminSubmission(id),
);
