import { fetchApiData } from '@/lib/api/client';

const REVIEW_REMINDER_URL = '/api/user/review-reminder';

/** Whether the signed-in learner has the 2-day review email ticked (RIN-917 revisit). */
export async function fetchReviewReminderOptedIn(): Promise<boolean> {
  const data = await fetchApiData<{ optedIn: boolean }>(REVIEW_REMINDER_URL);
  return data.optedIn;
}

/** Ticks or un-ticks the 2-day review email for this attempt (RIN-915 route). */
export async function saveReviewReminder(input: {
  attemptId: string;
  optIn: boolean;
  locale: 'vi' | 'en';
}): Promise<void> {
  await fetchApiData<unknown>(REVIEW_REMINDER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
