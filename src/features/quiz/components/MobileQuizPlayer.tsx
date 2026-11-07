'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineCheck, HiOutlineX } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { useHydrated } from '@/hooks/useHydrated';
import ReportQuiz from '@/features/quiz/components/ReportQuiz';
import type { QuizPlayQuestionViewModel } from '@/features/quiz/types/quiz-play-view-model';

type MobileQuizAnswerMap = Record<string, number | number[]>;
type MobileQuizTranslate = (key: string, values?: Record<string, string | number>) => string;

interface MobileQuizPlayerProps {
  quizSlug: string;
  quizTitle: string;
  questions: QuizPlayQuestionViewModel[];
  answers: MobileQuizAnswerMap;
  currentIndex: number;
  onAnswersChange: (answers: MobileQuizAnswerMap) => void;
  onIndexChange: (index: number) => void;
  onComplete: (answers: MobileQuizAnswerMap) => boolean | Promise<boolean>;
  onExit?: () => void;
  submitting?: boolean;
  submissionError?: string;
  /** Shown above question 1, e.g. the post-sign-in starter intro (RIN-913). */
  notice?: ReactNode;
  /** Pill beside the title, e.g. "Retry: 3 questions" (RIN-917). */
  titleBadge?: string;
}

interface MobileQuizHeaderProps {
  titleBadge?: string;
  answers: MobileQuizAnswerMap;
  isSubmitting: boolean;
  onRequestExit: () => void;
  questions: QuizPlayQuestionViewModel[];
  quizTitle: string;
  t: MobileQuizTranslate;
}

interface MobileQuestionCardProps {
  quizSlug: string;
  quizTitle: string;
  questionIndex: number;
  question: QuizPlayQuestionViewModel;
  handleOptionSelect: (
    question: QuizPlayQuestionViewModel,
    questionIndex: number,
    optionIndex: number,
  ) => void;
  isOptionSelected: (questionId: string, optionIndex: number) => boolean;
  isSubmitting: boolean;
  t: MobileQuizTranslate;
}

interface MobileQuizFooterProps {
  answeredCount: number;
  handleComplete: () => void;
  isSubmitting: boolean;
  questionsLength: number;
  submissionError?: string;
  t: MobileQuizTranslate;
}

function MobileQuizHeader({
  answers,
  isSubmitting,
  onRequestExit,
  questions,
  quizTitle,
  titleBadge,
  t,
}: MobileQuizHeaderProps) {
  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length;
  const answeredProgress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <header className="flex-shrink-0 border-b border-neutral-100 bg-white px-4 py-3 safe-area-top">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRequestExit}
          disabled={isSubmitting}
          className="-ml-2 text-neutral-600 active:bg-neutral-100"
          aria-label={t('exitQuiz')}
        >
          <HiOutlineX className="size-6" aria-hidden="true" />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-neutral-900">{quizTitle}</span>
              {titleBadge ? (
                <Pill tone="warm" className="shrink-0 px-2 py-0.5 text-xs">
                  {titleBadge}
                </Pill>
              ) : null}
            </span>
            <span className="shrink-0 text-xs font-medium text-neutral-500">
              {answeredCount}/{questions.length} {t('answered')}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
            role="progressbar"
            aria-label={t('progress')}
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={answeredCount}
          >
            <div
              className="h-full rounded-full bg-brand-action transition-[width] duration-300"
              style={{ width: `${answeredProgress}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileQuestionCard({
  quizSlug,
  quizTitle,
  questionIndex,
  question,
  handleOptionSelect,
  isOptionSelected,
  isSubmitting,
  t,
}: MobileQuestionCardProps) {
  const isSingle = question.type === 'single';
  // Server-rendered options stay disabled until hydration, or a tap is lost (RIN-1133).
  const hydrated = useHydrated();
  const helperId = `mobile-quiz-question-${questionIndex}-helper`;

  return (
    <section
      id={`mobile-quiz-question-${questionIndex}`}
      data-question-index={questionIndex}
      className="scroll-mt-4 rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}
    >
      {question.questionImage ? (
        <div className="mb-4 overflow-hidden rounded-xl bg-neutral-100">
          <Image
            src={question.questionImage}
            alt={t('questionImageAlt', { number: questionIndex + 1 })}
            width={400}
            height={144}
            className="h-auto max-h-36 w-full object-contain"
          />
        </div>
      ) : null}

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
            {t('question')} {questionIndex + 1}
          </span>
          <ReportQuiz
            compact
            quizSlug={quizSlug}
            quizTitle={quizTitle}
            questionId={question.id}
            questionNumber={questionIndex + 1}
            questionText={question.question}
          />
        </div>
        <QuestionContent
          content={question.question}
          className="text-base font-medium leading-relaxed text-neutral-900"
        />
        <p id={helperId} className="mt-2 text-xs text-neutral-500">
          {isSingle ? t('singleChoiceHelper') : t('multipleChoiceHelper')}
        </p>
      </div>

      {/* RIN-987: screen readers announce radio vs checkbox, and the indicator
          shape (round vs square) tells sighted learners the same thing. */}
      <div
        role={isSingle ? 'radiogroup' : 'group'}
        aria-labelledby={helperId}
        className="space-y-2.5"
      >
        {question.options.map((option, optionIndex) => {
          const optionImage = question.optionImages?.[optionIndex];
          const selected = isOptionSelected(question.id, optionIndex);

          return (
            <button
              type="button"
              key={`${optionIndex}-${option}`}
              role={isSingle ? 'radio' : 'checkbox'}
              aria-checked={selected}
              onClick={() => handleOptionSelect(question, questionIndex, optionIndex)}
              disabled={isSubmitting || !hydrated}
              className={`w-full rounded-xl border-2 p-4 text-left transition-all duration-150 disabled:pointer-events-none disabled:opacity-70 ${
                selected
                  ? 'border-brand-action bg-orange-50'
                  : 'border-neutral-100 bg-neutral-50 active:border-neutral-200 active:bg-neutral-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  data-option-indicator
                  aria-hidden="true"
                  className={`mt-0.5 flex size-6 flex-shrink-0 items-center justify-center border-2 transition-all duration-150 ${
                    isSingle ? 'rounded-full' : 'rounded-md'
                  } ${selected ? 'border-brand-action bg-brand-action' : 'border-neutral-300 bg-white'}`}
                >
                  {selected ? <HiOutlineCheck className="size-4 text-white" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <QuestionContent
                    content={option}
                    variant="option"
                    className="text-sm text-neutral-800"
                  />
                  {optionImage ? (
                    <div className="mt-2 overflow-hidden rounded-lg bg-neutral-100">
                      <Image
                        src={optionImage}
                        alt={t('optionImageAlt', {
                          option: String.fromCharCode(65 + optionIndex),
                        })}
                        width={320}
                        height={120}
                        className="h-auto max-h-28 w-full object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MobileQuizFooter({
  answeredCount,
  handleComplete,
  isSubmitting,
  questionsLength,
  submissionError,
  t,
}: MobileQuizFooterProps) {
  return (
    <footer className="flex-shrink-0 border-t border-neutral-100 bg-white p-4 safe-area-bottom">
      {submissionError ? (
        <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700">
          {submissionError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleComplete}
        disabled={isSubmitting}
        // RIN-987/RIN-979: the button is always clickable (a partial attempt
        // asks for confirmation), so it always looks enabled, like desktop's
        // primary submit. The old neutral-100 fill read as disabled.
        className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-trust py-4 font-semibold text-white transition-all duration-200 active:scale-[0.98] active:bg-brand-trust-hover disabled:cursor-not-allowed disabled:opacity-80 disabled:active:scale-100"
      >
        {isSubmitting ? (
          <>
            <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {t('submitting')}
          </>
        ) : (
          t('finishProgress', { answered: answeredCount, total: questionsLength })
        )}
      </button>
    </footer>
  );
}

export function MobileQuizPlayer({
  quizSlug,
  quizTitle,
  questions,
  answers,
  currentIndex,
  onAnswersChange,
  onIndexChange,
  onComplete,
  onExit,
  submitting = false,
  submissionError,
  notice,
  titleBadge,
}: MobileQuizPlayerProps) {
  const t = useTranslations('quiz');
  const [submitIntent, setSubmitIntent] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const didRestoreScrollRef = useRef(false);
  const isSubmitting = submitting || submitIntent;

  useEffect(() => {
    if (didRestoreScrollRef.current || currentIndex <= 0) return;
    didRestoreScrollRef.current = true;
    scrollContainerRef.current
      ?.querySelector<HTMLElement>(`[data-question-index="${currentIndex}"]`)
      ?.scrollIntoView({ block: 'start' });
  }, [currentIndex]);

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-50 p-6 text-center text-neutral-700">
        {t('quizNotFound')}
      </div>
    );
  }

  function handleOptionSelect(
    question: QuizPlayQuestionViewModel,
    questionIndex: number,
    optionIndex: number,
  ) {
    if (isSubmitting) return;

    onIndexChange(questionIndex);
    if (question.type === 'single') {
      onAnswersChange({ ...answers, [question.id]: optionIndex });
      return;
    }

    const storedAnswer = answers[question.id];
    if (storedAnswer !== undefined && !Array.isArray(storedAnswer)) {
      throw new Error(`Multiple-choice question ${question.id} has a scalar answer`);
    }
    const current = storedAnswer ?? [];
    const next = current.includes(optionIndex)
      ? current.filter((index) => index !== optionIndex)
      : [...current, optionIndex];
    onAnswersChange({ ...answers, [question.id]: next });
  }

  function isOptionSelected(questionId: string, optionIndex: number) {
    const answer = answers[questionId];
    return Array.isArray(answer) ? answer.includes(optionIndex) : answer === optionIndex;
  }

  const answeredCount = Object.keys(answers).length;

  async function submitCurrentAnswers() {
    if (isSubmitting) return;

    setSubmitIntent(true);
    try {
      const submitted = await onComplete(answers);
      if (submitted) setShowSubmitConfirm(false);
    } catch (error) {
      console.error('Quiz submission error:', error);
    }
    setSubmitIntent(false);
  }

  function handleComplete() {
    if (isSubmitting) return;
    if (answeredCount < questions.length) {
      setShowSubmitConfirm(true);
    } else {
      void submitCurrentAnswers();
    }
  }

  return (
    <div
      data-quiz-player
      className="fixed inset-0 z-50 flex flex-col bg-neutral-50"
      aria-busy={isSubmitting}
    >
      <MobileQuizHeader
        answers={answers}
        isSubmitting={isSubmitting}
        onRequestExit={() => setShowExitConfirm(true)}
        questions={questions}
        quizTitle={quizTitle}
        {...(titleBadge ? { titleBadge } : {})}
        t={t}
      />

      <main ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="mx-auto max-w-xl space-y-4">
          {notice}
          {questions.map((question, questionIndex) => (
            <MobileQuestionCard
              key={question.id}
              quizSlug={quizSlug}
              quizTitle={quizTitle}
              questionIndex={questionIndex}
              question={question}
              handleOptionSelect={handleOptionSelect}
              isOptionSelected={isOptionSelected}
              isSubmitting={isSubmitting}
              t={t}
            />
          ))}
        </div>
      </main>

      <MobileQuizFooter
        answeredCount={answeredCount}
        handleComplete={handleComplete}
        isSubmitting={isSubmitting}
        questionsLength={questions.length}
        {...(submissionError !== undefined ? { submissionError } : {})}
        t={t}
      />

      <ConfirmModal
        isOpen={showSubmitConfirm}
        title={`${t('submitQuiz')}?`}
        message={
          <div className="space-y-3">
            <p>{t('unansweredWarning', { count: questions.length - answeredCount })}</p>
            {submissionError ? (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium leading-5 text-red-700">
                {submissionError}
              </p>
            ) : null}
          </div>
        }
        confirmText={t('submit')}
        cancelText={t('cancel')}
        confirmVariant="primary"
        isLoading={isSubmitting}
        onCancel={() => setShowSubmitConfirm(false)}
        onConfirm={() => void submitCurrentAnswers()}
      />
      <ConfirmModal
        isOpen={showExitConfirm}
        title={t('exitQuiz')}
        message={t('exitQuizWarning')}
        confirmText={t('exitQuiz')}
        cancelText={t('continueQuiz')}
        confirmVariant="destructive"
        onCancel={() => setShowExitConfirm(false)}
        onConfirm={() => {
          setShowExitConfirm(false);
          onExit?.();
        }}
      />
    </div>
  );
}
