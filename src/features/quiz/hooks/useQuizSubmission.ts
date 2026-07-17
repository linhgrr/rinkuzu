'use client';

import { useRef, useState } from 'react';
import { submitQuizAttemptViewModel } from '@/features/quiz/api/quiz-interaction-api';
import type { QuizAnswer } from '@/features/quiz/types/quiz-interaction-view-model';

interface UseQuizSubmissionParams<TQuestion, TQuiz extends { questions: TQuestion[] }> {
  slug: string;
  quiz: TQuiz | null;
  userAnswers: QuizAnswer[];
  userEmail: string;
  sessionEmail?: string;
  onSubmitSuccess: (attemptId: string, score: number) => void | Promise<void>;
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
  const submittingRef = useRef(false);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const finishSubmission = () => {
    submittingRef.current = false;
    setSubmitting(false);
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
    });

    idempotencyRef.current = null;
    await onSubmitSuccess(data.attemptId, data.score);
  };

  const runSubmission = async (
    answers: QuizAnswer[],
    closeConfirmation: boolean,
  ): Promise<boolean> => {
    if (!quiz || submittingRef.current) return false;

    submittingRef.current = true;
    onSubmitStart?.();
    setSubmitting(true);
    try {
      await submitQuizAnswers(answers);
      if (closeConfirmation) setShowSubmitConfirm(false);
      finishSubmission();
      return true;
    } catch (error) {
      console.error('Quiz submission error:', error);
      onSubmitError(error instanceof Error ? error.message : 'Failed to submit quiz');
      finishSubmission();
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
