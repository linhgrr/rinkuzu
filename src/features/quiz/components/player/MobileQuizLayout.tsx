'use client';

import { MobileQuizPlayer } from '@/features/quiz/components/MobileQuizPlayer';
import { IQuiz } from '@/types';

type QuizAnswer = number | number[];

interface MobileQuizLayoutProps {
  quiz: IQuiz;
  onComplete: (answers: QuizAnswer[]) => void;
  onExit: () => void;
}

export function MobileQuizLayout({ quiz, onComplete, onExit }: MobileQuizLayoutProps) {
  const questionsWithId = quiz.questions.map((question, index) => ({
    _id: `q-${index}`,
    question: question.question,
    options: question.options,
    type: question.type,
    questionImage: question.questionImage,
  }));

  const handleMobileComplete = (answers: Record<string, number | number[]>) => {
    const orderedAnswers: QuizAnswer[] = quiz.questions.map((question, index) => {
      const questionId = `q-${index}`;
      const answer = answers[questionId];
      return answer !== undefined ? answer : -1;
    });

    onComplete(orderedAnswers);
  };

  return (
    <MobileQuizPlayer
      questions={questionsWithId}
      onComplete={handleMobileComplete}
      onExit={onExit}
    />
  );
}
