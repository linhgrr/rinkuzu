'use client';

import { useCallback, useState } from 'react';
import { fetchApiSuccess } from '@/lib/api/client';

type QuizAnswer = number | number[];

interface UseQuizSubmissionParams<TQuiz> {
  slug: string;
  quiz: TQuiz | null;
  userAnswers: QuizAnswer[];
  userEmail: string;
  sessionEmail?: string;
  onSubmitSuccess: (attemptId: string, score: number) => void;
  onSubmitStart?: () => void;
  onSubmitError: (message: string) => void;
  mapAnswersToOriginalOrder: (quiz: TQuiz, answers: QuizAnswer[]) => QuizAnswer[];
  isQuestionAnswered: (question: any, answer: QuizAnswer) => boolean;
}

export function useQuizSubmission<TQuiz>({
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
}: UseQuizSubmissionParams<TQuiz>) {
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(0);

  const submitQuizAnswers = useCallback(
    async (answersToSubmit: QuizAnswer[]) => {
      if (!quiz) return;

      const payload = {
        answers: mapAnswersToOriginalOrder(quiz, answersToSubmit),
        userEmail: sessionEmail || userEmail.trim(),
      };

      const data = await fetchApiSuccess<{ attemptId: string; score: number }>(
        `/api/quiz/${slug}/attempt`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      onSubmitSuccess(data.data.attemptId, data.data.score);
    },
    [mapAnswersToOriginalOrder, onSubmitSuccess, quiz, sessionEmail, slug, userEmail],
  );

  const handleQuizComplete = useCallback(
    async (answers: QuizAnswer[]): Promise<boolean> => {
      if (!quiz || submitting) return false;

      onSubmitStart?.();
      setSubmitting(true);
      try {
        await submitQuizAnswers(answers);
        return true;
      } catch (error) {
        console.error('Quiz submission error:', error);
        onSubmitError(error instanceof Error ? error.message : 'Failed to submit quiz');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmitError, onSubmitStart, quiz, submitQuizAnswers, submitting],
  );

  const completeSubmit = useCallback(async (): Promise<boolean> => {
    if (!quiz || submitting) return false;

    onSubmitStart?.();
    setSubmitting(true);
    try {
      await submitQuizAnswers(userAnswers);
      setShowSubmitConfirm(false);
      return true;
    } catch (error) {
      console.error('Quiz submission error:', error);
      onSubmitError(error instanceof Error ? error.message : 'Failed to submit quiz');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [onSubmitError, onSubmitStart, quiz, submitQuizAnswers, submitting, userAnswers]);

  const submitQuiz = useCallback(async (): Promise<boolean> => {
    if (!quiz || submitting) return false;

    const questions = (quiz as any).questions ?? [];
    const unanswered = userAnswers.filter((answer, index) => {
      const question = questions[index];
      return !isQuestionAnswered(question, answer);
    }).length;

    if (unanswered > 0) {
      setUnansweredCount(unanswered);
      setShowSubmitConfirm(true);
      return false;
    }

    return completeSubmit();
  }, [completeSubmit, isQuestionAnswered, quiz, submitting, userAnswers]);

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
