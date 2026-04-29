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
    async (answers: QuizAnswer[]) => {
      setSubmitting(true);
      try {
        await submitQuizAnswers(answers);
      } catch (error) {
        console.error('Quiz submission error:', error);
        onSubmitError(error instanceof Error ? error.message : 'Failed to submit quiz');
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmitError, submitQuizAnswers],
  );

  const completeSubmit = useCallback(async () => {
    if (!quiz) return;

    setSubmitting(true);
    try {
      await submitQuizAnswers(userAnswers);
    } catch (error) {
      console.error('Quiz submission error:', error);
      onSubmitError(error instanceof Error ? error.message : 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  }, [onSubmitError, quiz, submitQuizAnswers, userAnswers]);

  const submitQuiz = useCallback(async () => {
    if (!quiz) return;

    const questions = (quiz as any).questions ?? [];
    const unanswered = userAnswers.filter((answer, index) => {
      const question = questions[index];
      return !isQuestionAnswered(question, answer);
    }).length;

    if (unanswered > 0) {
      setUnansweredCount(unanswered);
      setShowSubmitConfirm(true);
      return;
    }

    await completeSubmit();
  }, [completeSubmit, isQuestionAnswered, quiz, userAnswers]);

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
