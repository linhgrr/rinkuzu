// /src/components/quiz/MobileQuizPlayer.tsx
'use client';

import Image from 'next/image';
import { useState, useCallback, useRef, type TouchEvent } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineCheck } from '@/components/icons';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface Question {
  _id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  questionImage?: string;
}

interface MobileQuizPlayerProps {
  questions: Question[];
  onComplete: (answers: Record<string, number | number[]>) => boolean | Promise<boolean>;
  onExit?: () => void;
  submitting?: boolean;
  submissionError?: string;
}

function MobileQuizHeader({
  answers,
  currentIndex,
  goNext,
  goPrev,
  isFirst,
  isLast,
  isSubmitting,
  questions,
  t,
}: {
  answers: Record<string, number | number[]>;
  currentIndex: number;
  goNext: () => void;
  goPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  isSubmitting: boolean;
  questions: Question[];
  t: (key: string) => string;
}) {
  return (
    <div className="flex-shrink-0 border-b border-neutral-100 bg-white px-4 py-3 safe-area-top">
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={isFirst || isSubmitting}
          className="rounded-full p-2 -ml-2 transition-colors active:bg-neutral-100"
          aria-label="Previous question"
        >
          <HiOutlineChevronLeft
            className={`size-6 ${isFirst ? 'text-neutral-300' : 'text-neutral-600'}`}
            aria-hidden="true"
          />
        </button>

        <div className="text-center">
          <span className="text-sm font-semibold text-neutral-900">
            {t('question')} {currentIndex + 1} / {questions.length}
          </span>
          <div className="mx-auto mt-2 flex max-w-[200px] flex-wrap justify-center gap-1">
            {questions.map((question, index) => (
              <div
                key={question._id}
                className={`size-2 rounded-full transition-colors ${
                  index === currentIndex
                    ? 'bg-brand-action'
                    : answers[question._id] !== undefined
                      ? 'bg-brand-trust'
                      : 'bg-neutral-200'
                }`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={goNext}
          disabled={isLast || isSubmitting}
          className="rounded-full p-2 -mr-2 transition-colors active:bg-neutral-100"
          aria-label="Next question"
        >
          <HiOutlineChevronRight
            className={`size-6 ${isLast ? 'text-neutral-300' : 'text-neutral-600'}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}

function MobileQuestionCard({
  currentIndex,
  currentQuestion,
  handleOptionSelect,
  handleTouchEnd,
  handleTouchMove,
  handleTouchStart,
  isOptionSelected,
  isSubmitting,
  t,
}: {
  currentIndex: number;
  currentQuestion: Question;
  handleOptionSelect: (optionIndex: number) => void;
  handleTouchEnd: () => void;
  handleTouchMove: (event: TouchEvent<HTMLDivElement>) => void;
  handleTouchStart: (event: TouchEvent<HTMLDivElement>) => void;
  isOptionSelected: (optionIndex: number) => boolean;
  isSubmitting: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="flex-1 overflow-hidden p-4">
      <div
        className="h-full touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={currentQuestion._id}
          className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm"
        >
          {currentQuestion.questionImage && (
            <div className="mb-4 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">
              <Image
                src={currentQuestion.questionImage}
                alt={`Image for question ${currentIndex + 1}`}
                width={400}
                height={144}
                className="h-auto max-h-36 w-full object-contain"
              />
            </div>
          )}

          <div className="mb-4 flex-shrink-0">
            <span className="mb-2 inline-block rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
              {currentQuestion.type === 'single'
                ? t('singleChoiceHelper')
                : t('multipleChoiceHelper')}
            </span>
            <p className="text-base font-medium leading-relaxed text-neutral-900">
              {currentQuestion.question}
            </p>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto pb-2">
            {currentQuestion.options.map((option, optionIndex) => (
              <button
                key={optionIndex}
                onClick={() => handleOptionSelect(optionIndex)}
                disabled={isSubmitting}
                className={`w-full rounded-xl border-2 p-4 text-left transition-all duration-150 disabled:pointer-events-none disabled:opacity-70 ${
                  isOptionSelected(optionIndex)
                    ? 'border-brand-action bg-orange-50'
                    : 'border-neutral-100 bg-neutral-50 active:border-neutral-200 active:bg-neutral-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                      isOptionSelected(optionIndex)
                        ? 'border-brand-action bg-brand-action'
                        : 'border-neutral-300 bg-white'
                    }`}
                  >
                    {isOptionSelected(optionIndex) && (
                      <HiOutlineCheck className="size-4 text-white" />
                    )}
                  </div>
                  <span className="flex-1 text-sm text-neutral-800">{option}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileQuizFooter({
  answeredCount,
  handleComplete,
  isSubmitting,
  questionsLength,
  submissionError,
  t,
}: {
  answeredCount: number;
  handleComplete: () => void;
  isSubmitting: boolean;
  questionsLength: number;
  submissionError?: string;
  t: (key: string) => string;
}) {
  return (
    <div className="flex-shrink-0 border-t border-neutral-100 bg-white p-4 safe-area-bottom">
      <p className="mb-3 text-center text-xs text-neutral-400">
        ← {t('previous')} / {t('next')} →
      </p>

      {submissionError && (
        <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700">
          {submissionError}
        </div>
      )}

      <button
        onClick={handleComplete}
        disabled={isSubmitting}
        className={`w-full rounded-full py-4 font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80 disabled:active:scale-100 ${
          answeredCount === questionsLength
            ? 'bg-brand-trust text-white active:bg-brand-trust-hover'
            : isSubmitting
              ? 'bg-brand-trust text-white'
              : 'bg-neutral-100 text-neutral-600 active:bg-neutral-200'
        }`}
      >
        {isSubmitting ? (
          <>
            <svg
              className="size-5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {t('submitting')}
          </>
        ) : (
          `${t('complete')} (${answeredCount}/${questionsLength} ${t('answered')})`
        )}
      </button>
    </div>
  );
}

export function MobileQuizPlayer({
  questions,
  onComplete,
  onExit: _onExit,
  submitting = false,
  submissionError,
}: MobileQuizPlayerProps) {
  const t = useTranslations('quiz');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const [submitIntent, setSubmitIntent] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const isSubmitting = submitting || submitIntent;

  const currentQuestion = questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;

  const goNext = useCallback(() => {
    if (!isLast && !isSubmitting) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [isLast, isSubmitting]);

  const goPrev = useCallback(() => {
    if (!isFirst && !isSubmitting) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [isFirst, isSubmitting]);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touchX = event.touches[0]?.clientX;
    touchStartXRef.current = touchX ?? null;
    touchCurrentXRef.current = touchX ?? null;
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    touchCurrentXRef.current = event.touches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (touchStartXRef.current === null || touchCurrentXRef.current === null) {
      return;
    }

    const deltaX = touchCurrentXRef.current - touchStartXRef.current;
    const threshold = 50;

    if (deltaX > threshold && !isFirst) {
      goPrev();
    } else if (deltaX < -threshold && !isLast) {
      goNext();
    }

    touchStartXRef.current = null;
    touchCurrentXRef.current = null;
  }, [goNext, goPrev, isFirst, isLast, isSubmitting]);

  const handleOptionSelect = useCallback(
    (optionIndex: number) => {
      if (isSubmitting) {
        return;
      }

      const qId = currentQuestion._id;

      if (currentQuestion.type === 'single') {
        setAnswers((prev) => ({ ...prev, [qId]: optionIndex }));
      } else {
        setAnswers((prev) => {
          const current = (prev[qId] as number[]) || [];
          const newAnswers = current.includes(optionIndex)
            ? current.filter((i) => i !== optionIndex)
            : [...current, optionIndex];
          return { ...prev, [qId]: newAnswers };
        });
      }
    },
    [currentQuestion, isSubmitting],
  );

  const isOptionSelected = useCallback(
    (optionIndex: number) => {
      const answer = answers[currentQuestion._id];
      if (Array.isArray(answer)) {
        return answer.includes(optionIndex);
      }
      return answer === optionIndex;
    },
    [answers, currentQuestion._id],
  );

  const answeredCount = Object.keys(answers).length;
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const submitCurrentAnswers = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setSubmitIntent(true);
    try {
      const submitted = await onComplete(answers);
      if (submitted) {
        setShowSubmitConfirm(false);
      }
    } catch (error) {
      console.error('Quiz submission error:', error);
    } finally {
      setSubmitIntent(false);
    }
  }, [answers, isSubmitting, onComplete]);

  const handleComplete = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (answeredCount < questions.length) {
      setShowSubmitConfirm(true);
    } else {
      void submitCurrentAnswers();
    }
  }, [answeredCount, isSubmitting, questions.length, submitCurrentAnswers]);

  return (
    <div className="fixed inset-0 bg-neutral-50 flex flex-col z-50" aria-busy={isSubmitting}>
      <MobileQuizHeader
        answers={answers}
        currentIndex={currentIndex}
        goNext={goNext}
        goPrev={goPrev}
        isFirst={isFirst}
        isLast={isLast}
        isSubmitting={isSubmitting}
        questions={questions}
        t={t}
      />

      <MobileQuestionCard
        currentIndex={currentIndex}
        currentQuestion={currentQuestion}
        handleOptionSelect={handleOptionSelect}
        handleTouchEnd={handleTouchEnd}
        handleTouchMove={handleTouchMove}
        handleTouchStart={handleTouchStart}
        isOptionSelected={isOptionSelected}
        isSubmitting={isSubmitting}
        t={t}
      />

      <MobileQuizFooter
        answeredCount={answeredCount}
        handleComplete={handleComplete}
        isSubmitting={isSubmitting}
        questionsLength={questions.length}
        submissionError={submissionError}
        t={t}
      />

      <ConfirmModal
        isOpen={showSubmitConfirm}
        title={`${t('submitQuiz')}?`}
        message={
          <div className="space-y-3">
            <p>{t('unansweredWarning', { count: questions.length - answeredCount })}</p>
            {submissionError && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium leading-5 text-red-700">
                {submissionError}
              </p>
            )}
          </div>
        }
        confirmText={t('submit')}
        cancelText={t('cancel')}
        confirmVariant="primary"
        isLoading={isSubmitting}
        onCancel={() => setShowSubmitConfirm(false)}
        onConfirm={() => void submitCurrentAnswers()}
      />
    </div>
  );
}
