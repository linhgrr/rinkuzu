import { ApiResponseError } from '@/lib/api/client';
import {
  QUIZ_TEXT_MAX_CHARS,
  QUIZ_TEXT_MIN_CHARS,
  QUIZ_TEXT_TOO_LONG,
  QUIZ_TEXT_TOO_SHORT,
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

/** A length refusal from a text-draft route, told apart so each gets its own copy. */
export type QuizTextRefusal = 'too_long' | 'too_short';

function refusalReason(meta: unknown): string {
  if (typeof meta !== 'object' || meta === null) return '';
  const reason = (meta as Record<string, unknown>)['reason'];
  return typeof reason === 'string' ? reason : '';
}

/**
 * Which length bound the server refused `text` for (RIN-1542). The route's reason wins
 * (`text_too_long`, `guest_text_too_short`...); without one, a 413 is too long and a 422
 * goes by the length the client already knows. A 422 about anything else is not a length
 * refusal and returns null, so it gets the generic copy.
 */
export function quizTextRefusal(error: unknown, text: string): QuizTextRefusal | null {
  if (!(error instanceof ApiResponseError)) return null;
  const reason = refusalReason(error.meta);
  if (reason.endsWith(QUIZ_TEXT_TOO_LONG)) return 'too_long';
  if (reason.endsWith(QUIZ_TEXT_TOO_SHORT)) return 'too_short';
  if (error.status === 413) return 'too_long';
  if (error.status !== 422) return null;
  const { kind } = quizTextLimitState(text);
  if (kind === 'over') return 'too_long';
  return kind === 'short' || kind === 'empty' ? 'too_short' : null;
}
