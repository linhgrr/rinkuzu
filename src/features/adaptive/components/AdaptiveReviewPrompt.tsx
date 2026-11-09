'use client';

import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { adaptiveReviewReminderApi } from '@/features/quiz/api/review-reminder-api';
import { ReviewReminderPrompt } from '@/features/quiz/components/result/ReviewReminderPrompt';
import { captureAnalyticsEvent } from '@/lib/analytics/client';

/** Analytics campaign of the week-1 return loop (RIN-911), shared by both paths. */
const REVIEW_CAMPAIGN = 'w1-review';

/**
 * The 2-day review prompt on the adaptive end screen (Path B, RIN-1364). Signed
 * in only; the server shows it only while the learner's latest adaptive
 * completion is at most 46 h old, and otherwise it renders nothing.
 */
export function AdaptiveReviewPrompt() {
  const { status } = useSession();
  const t = useTranslations('adaptiveLearning.result');
  const locale = useLocale() === 'en' ? 'en' : 'vi';
  if (status !== 'authenticated') return null;
  return (
    <ReviewReminderPrompt
      missedCount={0}
      question={t('reviewPromptQuestion')}
      stacked
      loadStatus={adaptiveReviewReminderApi.loadStatus}
      optIn={() => adaptiveReviewReminderApi.optIn(locale)}
      snooze={adaptiveReviewReminderApi.snooze}
      onOptIn={() =>
        captureAnalyticsEvent('review_email_opt_in', {
          campaign: REVIEW_CAMPAIGN,
          source: 'adaptive_end_review',
        })
      }
    />
  );
}
