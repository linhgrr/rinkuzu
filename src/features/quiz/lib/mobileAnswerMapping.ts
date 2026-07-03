import type { QuizQuestionInputViewModel } from '@/features/quiz/types/quiz-question';
import type { QuizAnswer } from '@/features/quiz/types/quiz-interaction-view-model';

export function mapMobileAnswersToOrderedAnswers(
  quiz: { questions: Pick<QuizQuestionInputViewModel, 'type'>[] },
  answers: Record<string, number | number[]>,
): QuizAnswer[] {
  return quiz.questions.map((question, index) => {
    const questionId = `q-${index}`;
    const answer = answers[questionId];

    if (answer !== undefined) {
      return answer;
    }

    return question.type === 'multiple' ? [] : -1;
  });
}
