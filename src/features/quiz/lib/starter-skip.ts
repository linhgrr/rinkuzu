import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { STARTER_SKIPPED_COOKIE } from '@/shared/constants/starter-quiz';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Skip on the post-sign-in starter quiz (RIN-913): a first-party, per-browser
 * cookie that `/start` honours, so sign-in in this browser never opens the
 * starter again. Nothing is stored server-side; the event carries no personal data.
 */
export function markStarterQuizSkipped(quizSlug: string): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${STARTER_SKIPPED_COOKIE}=1; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
  captureAnalyticsEvent('starter_quiz_skipped', { quiz_slug: quizSlug });
}
