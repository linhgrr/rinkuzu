import type { QuizQuestionInputViewModel } from '@/features/quiz/types/quiz-question';
import type { QuizAnswer } from '@/features/quiz/types/quiz-interaction-view-model';

interface MobileAnswerQuizInput {
  questions: Array<Pick<QuizQuestionInputViewModel, 'type'> & { id: string }>;
}

export function mapMobileAnswersToOrderedAnswers(
  quiz: MobileAnswerQuizInput,
  answers: Record<string, number | number[]>,
): QuizAnswer[] {
  return quiz.questions.map((question) => {
    const answer = answers[question.id];

    if (answer !== undefined) {
      return answer;
    }

    return question.type === 'multiple' ? [] : -1;
  });
}
