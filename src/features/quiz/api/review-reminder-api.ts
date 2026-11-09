import type {
  ReviewReminderOptInInput,
  ReviewReminderOptInOutcome,
  ReviewReminderPromptStatus,
} from '@/features/quiz/types/quiz-result-page-view-model';
import { fetchApiData } from '@/lib/api/client';

const REVIEW_REMINDER_URL = '/api/user/review-reminder';

function postReviewReminder<T>(body: Record<string, unknown>): Promise<T> {
  return fetchApiData<T>(REVIEW_REMINDER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Opted in, snoozed, and whether this attempt can still get the 2-day email (RIN-1362). */
export function fetchReviewReminderStatus(attemptId: string): Promise<ReviewReminderPromptStatus> {
  return fetchApiData<ReviewReminderPromptStatus>(
    `${REVIEW_REMINDER_URL}?attemptId=${encodeURIComponent(attemptId)}`,
  );
}

/** "Remind me in 2 days": records consent and schedules the email (idempotent per attempt). */
export function optInReviewReminder(
  input: ReviewReminderOptInInput,
): Promise<ReviewReminderOptInOutcome> {
  return postReviewReminder<ReviewReminderOptInOutcome>({ ...input, optIn: true });
}

/** "No thanks": hides the prompt for 7 days on every device; consent is unchanged. */
export async function snoozeReviewReminderPrompt(attemptId: string): Promise<void> {
  await postReviewReminder<unknown>({ attemptId, action: 'snooze' });
}
