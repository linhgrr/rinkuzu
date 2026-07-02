'use client';

import { MobileQuizPlayer } from '@/features/quiz/components/MobileQuizPlayer';
import { mapMobileAnswersToOrderedAnswers } from '@/features/quiz/lib/mobileAnswerMapping';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';

type QuizAnswer = number | number[];

interface MobileQuizLayoutProps {
  quiz: Pick<QuizPlayViewModel, 'questions'>;
  userAnswers: QuizAnswer[];
  currentQuestionIndex: number;
  onAnswersChange: (answers: QuizAnswer[]) => void;
  onIndexChange: (index: number) => void;
  onComplete: (answers: QuizAnswer[]) => boolean | Promise<boolean>;
  onExit: () => void;
  submitting: boolean;
  error?: string;
}

function orderedAnswersToMobileRecord(answers: QuizAnswer[]): Record<string, number | number[]> {
  const record: Record<string, number | number[]> = {};
  answers.forEach((answer, index) => {
    const isAnswered = Array.isArray(answer) ? answer.length > 0 : answer !== -1;
    if (isAnswered) {
      record[`q-${index}`] = answer;
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
  const questionsWithId = quiz.questions.map((question, index) => ({
    id: `q-${index}`,
    question: question.question,
    options: question.options,
    type: question.type,
    questionImage: question.questionImage,
  }));

  const handleMobileComplete = (answers: Record<string, number | number[]>) => {
    return onComplete(mapMobileAnswersToOrderedAnswers(quiz, answers));
  };

  const handleAnswersChange = (answers: Record<string, number | number[]>) => {
    onAnswersChange(mapMobileAnswersToOrderedAnswers(quiz, answers));
  };

  return (
    <MobileQuizPlayer
      questions={questionsWithId}
      answers={orderedAnswersToMobileRecord(userAnswers)}
      currentIndex={currentQuestionIndex}
      onAnswersChange={handleAnswersChange}
      onIndexChange={onIndexChange}
      onComplete={handleMobileComplete}
      onExit={onExit}
      submitting={submitting}
      submissionError={error}
    />
  );
}
