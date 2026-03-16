import { Question } from '@/types/quiz';

/**
 * Normalize mixed extractor payloads into the internal Question shape.
 */
export function normalizeExtractedQuestions(rawQuestions: any[]): Question[] {
  return rawQuestions.map((q: any) => {
    const questionType = q.type || 'single';
    const processedQuestion: Question = {
      question: q.question,
      options: q.options,
      type: questionType,
    };

    if (questionType === 'single') {
      let finalCorrectAnswer = q.correctAnswer;

      if (typeof finalCorrectAnswer === 'undefined') {
        if (typeof q.correctIndex === 'number') {
          finalCorrectAnswer = q.correctIndex;
        } else if (typeof q.originalCorrectIndex === 'number') {
          finalCorrectAnswer = q.originalCorrectIndex;
        } else {
          finalCorrectAnswer = 0;
        }
      }

      processedQuestion.correctIndex = finalCorrectAnswer;
    } else {
      processedQuestion.correctIndexes = q.correctIndexes || q.correctAnswers || [];
    }

    return processedQuestion;
  });
}
