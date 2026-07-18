import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import Quiz from '@/models/Quiz';
import { MAX_QUESTIONS_PER_QUIZ } from '@/lib/validation/question';

function question(index: number) {
  return {
    question: `Question ${index}`,
    options: ['A', 'B'],
    type: 'single' as const,
    correctIndex: 0,
  };
}

function quizWithQuestionCount(count: number) {
  return new Quiz({
    title: 'Bounded quiz',
    author: new Types.ObjectId(),
    slug: `bounded-quiz-${count}`,
    questions: Array.from({ length: count }, (_, index) => question(index)),
  });
}

describe('Quiz schema production bounds', () => {
  it('accepts the configured maximum number of questions', async () => {
    await expect(quizWithQuestionCount(MAX_QUESTIONS_PER_QUIZ).validate()).resolves.toBeUndefined();
  });

  it('rejects model-level writes above the configured maximum', async () => {
    await expect(quizWithQuestionCount(MAX_QUESTIONS_PER_QUIZ + 1).validate()).rejects.toThrow(
      `Quiz must contain between 1 and ${MAX_QUESTIONS_PER_QUIZ} questions`,
    );
  });
});
