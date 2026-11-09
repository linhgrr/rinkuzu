import {
  resolveQuizEntryAttribution,
  type QuizEntryAttribution,
} from '@/shared/constants/starter-quiz';

/**
 * First tracked quiz entry of this browser session (RIN-1242 B2): sessionStorage only, no
 * cookie, and the first touch wins. `signup_completed` adds it so blog signups are counted.
 */
const QUIZ_FIRST_TOUCH_STORAGE_KEY = 'rinkuzu_quiz_first_touch_v1';

function sessionStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    // Some privacy modes throw on access; attribution is best-effort.
    return null;
  }
}

/** Reads the stored first touch, re-validated; `{}` when absent, malformed or unreadable. */
export function readQuizFirstTouch(): QuizEntryAttribution {
  try {
    const raw = sessionStore()?.getItem(QUIZ_FIRST_TOUCH_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { entry?: unknown; post?: unknown; topic?: unknown } | null;
    return resolveQuizEntryAttribution(parsed?.entry, parsed?.post, parsed?.topic);
  } catch {
    return {};
  }
}

/** Keeps a tracked entry as the session's first touch unless one is already stored. */
export function rememberQuizFirstTouch(attribution: QuizEntryAttribution): void {
  const resolved = resolveQuizEntryAttribution(
    attribution.entry,
    attribution.post,
    attribution.topic,
  );
  if (resolved.entry === undefined || readQuizFirstTouch().entry !== undefined) return;
  try {
    sessionStore()?.setItem(QUIZ_FIRST_TOUCH_STORAGE_KEY, JSON.stringify(resolved));
  } catch {
    // Quota or privacy-mode failures must never break the quiz.
  }
}
