'use client';

import { useCallback, useState } from 'react';
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

  const submitQuizAnswers = useCallback(
    async (answersToSubmit: QuizAnswer[]) => {
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
