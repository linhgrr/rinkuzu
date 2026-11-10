import 'server-only';

import type {
  IPremiumDecisionNotifier,
  PremiumRejectNotice,
} from '@/interfaces/services/IPremiumDecisionNotifier';
import type { Types } from 'mongoose';
import {
  ActivationNudgeRepository,
  type NudgeLearner,
} from '@/repositories/ActivationNudgeRepository';
import { ROUTES } from '@/shared/constants/routes';
import { activationNudgeLocale } from './activation-nudge-policy';
import { queueMail, requiredObjectId, siteUrl } from './internal';
import { communicationEnvironment } from './resend';
import { renderPremiumReject } from './premium-reject-template';

/** The author's email and locale (MarketingPreference, else User), as the nudge reads them. */
export interface PremiumRejectRecipients {
  findLearner(userId: Types.ObjectId): Promise<NudgeLearner | null>;
}

/** One reject email per submission, whatever the number of retries (RIN-1348). */
function premiumRejectDedupeKey(submissionId: string): string {
  return `premium-reject:${submissionId}`;
}

/**
 * Queues the reject email to the submission's author through the outbox
 * (RIN-1348), rendered now in the author's locale. A deleted or disabled
 * account gets nothing.
 */
export class PremiumRejectMailNotifier implements IPremiumDecisionNotifier {
  constructor(
    private readonly recipients: PremiumRejectRecipients = new ActivationNudgeRepository(),
  ) {}

  async queueRejectEmail({ submission, quizMadePublic }: PremiumRejectNotice): Promise<void> {
    const authorId = requiredObjectId(submission.authorId, 'author id');
    const author = await this.recipients.findLearner(authorId);
    if (!author || author.disable) return;
    const locale = activationNudgeLocale(author.locale);
    const editUrl = new URL(
      `/${locale}${ROUTES.EDIT.QUIZ(encodeURIComponent(submission.sourceQuizId))}`,
      siteUrl(),
    ).toString();
    const mail = await renderPremiumReject({
      locale,
      quizTitle: submission.snapshot.title,
      ...(submission.reviewerNote ? { reviewerNote: submission.reviewerNote } : {}),
      quizMadePublic,
      editUrl,
    });
    await queueMail({
      kind: 'premium_decision',
      entityType: 'premium_submission',
      entityId: requiredObjectId(submission.id, 'submission id'),
      userId: authorId,
      to: author.email,
      from: communicationEnvironment('SUPPORT_MAIL_FROM'),
      ...mail,
      dedupeKey: premiumRejectDedupeKey(submission.id),
    });
  }
}
