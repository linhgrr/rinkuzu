import { z } from 'zod';

import {
  QUIZ_TEXT_MAX_CHARS,
  QUIZ_TEXT_MIN_CHARS,
  countQuizTextChars,
} from '@/shared/constants/quiz-text-source';

/** Issue messages the routes map to `text_too_short` (422) and `text_too_long` (413). */
export const QUIZ_TEXT_TOO_SHORT = 'text_too_short';
export const QUIZ_TEXT_TOO_LONG = 'text_too_long';

/** Pasted quiz source text (RIN-1536): trimmed, 200 to 20,000 code points. */
export const quizTextSchema = z
  .string()
  .trim()
  .superRefine((text, context) => {
    const length = countQuizTextChars(text);
    if (length < QUIZ_TEXT_MIN_CHARS) {
      context.addIssue({ code: 'custom', message: QUIZ_TEXT_TOO_SHORT });
    } else if (length > QUIZ_TEXT_MAX_CHARS) {
      context.addIssue({ code: 'custom', message: QUIZ_TEXT_TOO_LONG });
    }
  });
