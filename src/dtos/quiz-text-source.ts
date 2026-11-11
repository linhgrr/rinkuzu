import { z } from 'zod';

import {
  QUIZ_TEXT_MAX_CHARS,
  QUIZ_TEXT_MIN_CHARS,
  QUIZ_TEXT_TOO_LONG,
  QUIZ_TEXT_TOO_SHORT,
  countQuizTextChars,
} from '@/shared/constants/quiz-text-source';

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
