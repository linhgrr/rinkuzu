'use client';

import { MobileQuizPlayer } from '@/features/quiz/components/MobileQuizPlayer';
import { mapMobileAnswersToOrderedAnswers } from '@/features/quiz/lib/mobileAnswerMapping';
import { IQuiz } from '@/types';

type QuizAnswer = number | number[];

interface MobileQuizLayoutProps {
  quiz: IQuiz;
  onComplete: (answers: QuizAnswer[]) => boolean | Promise<boolean>;
  onExit: () => void;
  submitting: boolean;
  error?: string;
}

export function MobileQuizLayout({
  quiz,
  onComplete,
  onExit,
  submitting,
  error,
}: MobileQuizLayoutProps) {
  const questionsWithId = quiz.questions.map((question, index) => ({
    _id: `q-${index}`,
    question: question.question,
    options: question.options,
    type: question.type,
    questionImage: question.questionImage,
  }));

  const handleMobileComplete = (answers: Record<string, number | number[]>) => {
    return onComplete(mapMobileAnswersToOrderedAnswers(quiz, answers));
  };

  return (
    <MobileQuizPlayer
      questions={questionsWithId}
      onComplete={handleMobileComplete}
      onExit={onExit}
      submitting={submitting}
      submissionError={error}
    />
  );
}
