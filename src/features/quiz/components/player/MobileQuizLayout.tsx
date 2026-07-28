'use client';

import { MobileQuizPlayer } from '@/features/quiz/components/MobileQuizPlayer';
import { mapMobileAnswersToOrderedAnswers } from '@/features/quiz/lib/mobileAnswerMapping';
import type { QuizAnswer } from '@/features/quiz/types/quiz-interaction-view-model';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';

interface MobileQuizLayoutProps {
  quiz: Pick<QuizPlayViewModel, 'questions' | 'slug' | 'title'>;
  userAnswers: QuizAnswer[];
  currentQuestionIndex: number;
  onAnswersChange: (answers: QuizAnswer[]) => void;
  onIndexChange: (index: number) => void;
  onComplete: (answers: QuizAnswer[]) => boolean | Promise<boolean>;
  onExit: () => void;
  submitting: boolean;
  error?: string;
}

function orderedAnswersToMobileRecord(
  questions: QuizPlayViewModel['questions'],
  answers: QuizAnswer[],
): Record<string, number | number[]> {
  const record: Record<string, number | number[]> = {};
  answers.forEach((answer, index) => {
    const isAnswered = Array.isArray(answer) ? answer.length > 0 : answer !== -1;
    const question = questions[index];
    if (isAnswered && question) {
      record[question.id] = answer;
    }
  });
  return record;
}

export function MobileQuizLayout({
  quiz,
  userAnswers,
  currentQuestionIndex,
  onAnswersChange,
  onIndexChange,
  onComplete,
  onExit,
  submitting,
  error,
}: MobileQuizLayoutProps) {
  const questionsWithId = quiz.questions.map((question) => ({
    id: question.id,
    question: question.question,
    options: question.options,
    type: question.type,
    ...(question.questionImage !== undefined ? { questionImage: question.questionImage } : {}),
    ...(question.optionImages !== undefined ? { optionImages: question.optionImages } : {}),
  }));

  const handleMobileComplete = (answers: Record<string, number | number[]>) => {
    return onComplete(mapMobileAnswersToOrderedAnswers(quiz, answers));
  };

  const handleAnswersChange = (answers: Record<string, number | number[]>) => {
    onAnswersChange(mapMobileAnswersToOrderedAnswers(quiz, answers));
  };

  return (
    <MobileQuizPlayer
      quizSlug={quiz.slug}
      quizTitle={quiz.title}
      questions={questionsWithId}
      answers={orderedAnswersToMobileRecord(quiz.questions, userAnswers)}
      currentIndex={currentQuestionIndex}
      onAnswersChange={handleAnswersChange}
      onIndexChange={onIndexChange}
      onComplete={handleMobileComplete}
      onExit={onExit}
      submitting={submitting}
      {...(error !== undefined ? { submissionError: error } : {})}
    />
  );
}
