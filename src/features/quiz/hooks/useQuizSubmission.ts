'use client';

import { useRef, useState } from 'react';
import { submitQuizAttemptViewModel } from '@/features/quiz/api/quiz-interaction-api';
import { withPending } from '@/lib/async/with-pending';
import type { QuizAnswer } from '@/features/quiz/types/quiz-interaction-view-model';

interface UseQuizSubmissionParams<TQuestion, TQuiz extends { questions: TQuestion[] }> {
  slug: string;
  quiz: TQuiz | null;
  userAnswers: QuizAnswer[];
  userEmail: string;
  sessionEmail?: string;
  /** Retry-missed session: submitted so the server stores a retry attempt (RIN-917). */
  retryOfAttemptId?: string;
  onSubmitSuccess: (attemptId: string, score: number) => void | Promise<void>;
  onSubmitStart?: () => void;
  /** Receives the thrown value; the caller turns it into localized copy (RIN-753). */
  onSubmitError: (error: unknown) => void;
  mapAnswersToOriginalOrder: (quiz: TQuiz, answers: QuizAnswer[]) => QuizAnswer[];
  isQuestionAnswered: (question: TQuestion, answer: QuizAnswer) => boolean;
}

export function useQuizSubmission<TQuiz extends { questions: TQuestion[] }, TQuestion>({
  slug,
  quiz,
  userAnswers,
  userEmail,
  sessionEmail,
  retryOfAttemptId,
  onSubmitSuccess,
  onSubmitStart,
  onSubmitError,
  mapAnswersToOriginalOrder,
  isQuestionAnswered,
}: UseQuizSubmissionParams<TQuestion, TQuiz>) {
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const submittingRef = useRef(false);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  // The ref guards re-entry synchronously; the state drives the UI. They move together.
  const setSubmissionPending = (pending: boolean) => {
    submittingRef.current = pending;
    setSubmitting(pending);
  };

  const submitQuizAnswers = async (answersToSubmit: QuizAnswer[]) => {
    if (!quiz) return;

    const payload = {
      answers: mapAnswersToOriginalOrder(quiz, answersToSubmit),
      userEmail: sessionEmail || userEmail.trim(),
    };
    const fingerprint = JSON.stringify({ slug, ...payload });
    if (idempotencyRef.current?.fingerprint !== fingerprint) {
      idempotencyRef.current = { fingerprint, key: crypto.randomUUID() };
    }

    const data = await submitQuizAttemptViewModel({
      slug,
      answers: payload.answers,
      idempotencyKey: idempotencyRef.current.key,
      userEmail: payload.userEmail,
      ...(retryOfAttemptId ? { retryOfAttemptId } : {}),
    });

    idempotencyRef.current = null;
    await onSubmitSuccess(data.attemptId, data.score);
  };

  const runSubmission = async (
    answers: QuizAnswer[],
    closeConfirmation: boolean,
  ): Promise<boolean> => {
    if (!quiz || submittingRef.current) return false;

    onSubmitStart?.();
    try {
      await withPending(setSubmissionPending, () => submitQuizAnswers(answers));
      if (closeConfirmation) setShowSubmitConfirm(false);
      return true;
    } catch (error) {
      console.error('Quiz submission error:', error);
      onSubmitError(error);
      return false;
    }
  };

  const handleQuizComplete = async (answers: QuizAnswer[]): Promise<boolean> => {
    return runSubmission(answers, false);
  };

  const completeSubmit = async (): Promise<boolean> => {
    return runSubmission(userAnswers, true);
  };

  const submitQuiz = async (): Promise<boolean> => {
    if (!quiz || submittingRef.current) return false;

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
