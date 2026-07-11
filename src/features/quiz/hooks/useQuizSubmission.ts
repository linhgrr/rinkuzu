'use client';

import { useState } from 'react';
import { submitQuizAttemptViewModel } from '@/features/quiz/api/quiz-interaction-api';
import type { QuizAnswer } from '@/features/quiz/types/quiz-interaction-view-model';

interface UseQuizSubmissionParams<TQuestion, TQuiz extends { questions: TQuestion[] }> {
  slug: string;
  quiz: TQuiz | null;
  userAnswers: QuizAnswer[];
  userEmail: string;
  sessionEmail?: string;
  onSubmitSuccess: (attemptId: string, score: number) => void;
  onSubmitStart?: () => void;
  onSubmitError: (message: string) => void;
  mapAnswersToOriginalOrder: (quiz: TQuiz, answers: QuizAnswer[]) => QuizAnswer[];
  isQuestionAnswered: (question: TQuestion, answer: QuizAnswer) => boolean;
}

export function useQuizSubmission<TQuiz extends { questions: TQuestion[] }, TQuestion>({
  slug,
  quiz,
  userAnswers,
  userEmail,
  sessionEmail,
  onSubmitSuccess,
  onSubmitStart,
  onSubmitError,
  mapAnswersToOriginalOrder,
  isQuestionAnswered,
}: UseQuizSubmissionParams<TQuestion, TQuiz>) {
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(0);

  const submitQuizAnswers = async (answersToSubmit: QuizAnswer[]) => {
    if (!quiz) return;

    const payload = {
      answers: mapAnswersToOriginalOrder(quiz, answersToSubmit),
      userEmail: sessionEmail || userEmail.trim(),
    };

    const data = await submitQuizAttemptViewModel({
      slug,
      answers: payload.answers,
      userEmail: payload.userEmail,
    });

    onSubmitSuccess(data.attemptId, data.score);
  };

  const handleQuizComplete = async (answers: QuizAnswer[]): Promise<boolean> => {
    if (!quiz || submitting) return false;

    onSubmitStart?.();
    setSubmitting(true);
    try {
      await submitQuizAnswers(answers);
      setSubmitting(false);
      return true;
    } catch (error) {
      console.error('Quiz submission error:', error);
      onSubmitError(error instanceof Error ? error.message : 'Failed to submit quiz');
      setSubmitting(false);
      return false;
    }
  };

  const completeSubmit = async (): Promise<boolean> => {
    if (!quiz || submitting) return false;

    onSubmitStart?.();
    setSubmitting(true);
    try {
      await submitQuizAnswers(userAnswers);
      setShowSubmitConfirm(false);
      setSubmitting(false);
      return true;
    } catch (error) {
      console.error('Quiz submission error:', error);
      onSubmitError(error instanceof Error ? error.message : 'Failed to submit quiz');
      setSubmitting(false);
      return false;
    }
  };

  const submitQuiz = async (): Promise<boolean> => {
    if (!quiz || submitting) return false;

    const unanswered = userAnswers.filter((answer, index) => {
      const question = quiz.questions[index];
      if (!question) {
        throw new Error(`Quiz answer at index ${index} has no matching question`);
      }
      return !isQuestionAnswered(question, answer);
    }).length;

    if (unanswered > 0) {
      setUnansweredCount(unanswered);
      setShowSubmitConfirm(true);
      return false;
    }

    return completeSubmit();
  };

  return {
    submitting,
    showSubmitConfirm,
    setShowSubmitConfirm,
    unansweredCount,
    handleQuizComplete,
    completeSubmit,
    submitQuiz,
  };
}
