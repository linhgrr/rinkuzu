import {
  QUIZ_TEXT_MAX_CHARS,
  QUIZ_TEXT_MIN_CHARS,
  countQuizTextChars,
} from '@/shared/constants/quiz-text-source';

/** Where a pasted text stands against the 200 to 20,000 character bounds (RIN-1539). */
export type QuizTextLimitState =
  | { kind: 'empty'; count: 0 }
  | { kind: 'short'; count: number; missing: number }
  | { kind: 'ok'; count: number }
  | { kind: 'over'; count: number; over: number };

/** Counted as the server counts (trimmed, code points), so the button agrees with the route. */
export function quizTextLimitState(text: string): QuizTextLimitState {
  const count = countQuizTextChars(text);
  if (count === 0) return { kind: 'empty', count: 0 };
  if (count < QUIZ_TEXT_MIN_CHARS)
    return { kind: 'short', count, missing: QUIZ_TEXT_MIN_CHARS - count };
  if (count > QUIZ_TEXT_MAX_CHARS)
    return { kind: 'over', count, over: count - QUIZ_TEXT_MAX_CHARS };
  return { kind: 'ok', count };
}
