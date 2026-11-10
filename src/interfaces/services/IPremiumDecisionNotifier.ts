import type { PremiumQuizSubmission } from '@/entities/PremiumQuiz';

export interface PremiumRejectNotice {
  submission: PremiumQuizSubmission;
  /** Whether the reject moved the source quiz to `public` (RIN-1337). */
  quizMadePublic: boolean;
}

/** Tells a Premium contributor about a decision on their submission (RIN-1348). */
export interface IPremiumDecisionNotifier {
  /** Queues the author's reject email; idempotent per submission. */
  queueRejectEmail(notice: PremiumRejectNotice): Promise<void>;
}
