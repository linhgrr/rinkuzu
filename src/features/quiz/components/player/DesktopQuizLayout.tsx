'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { OptionImage, QuestionImage } from '@/components/ui/ImageDisplay';
import { Modal } from '@/components/ui/Modal';
import { ModalActions } from '@/components/ui/ModalActions';
import { HiOutlineArrowLeft, HiOutlineMail, HiOutlineUser } from 'react-icons/hi';
import ReportQuiz from '@/features/quiz/components/ReportQuiz';
import { isQuestionAnswered } from '@/features/quiz/lib/isQuestionAnswered';
import type { QuizAnswer } from '@/features/quiz/types/quiz-interaction-view-model';
import type { QuizPlayQuestionViewModel } from '@/features/quiz/types/quiz-play-view-model';

const QuestionDiscussion = dynamic(
  () =>
    import('@/features/quiz/components/QuestionDiscussion').then(
      (module) => module.QuestionDiscussion,
    ),
  {
    loading: () => (
      <div
        aria-busy="true"
        className="h-full min-h-64 w-full animate-pulse bg-neutral-50 md:sticky md:top-0 md:h-screen md:w-80 md:border-l md:border-neutral-200"
      />
    ),
  },
);

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

interface OptionPreviewProps {
  src?: string;
  alt: string;
  className?: string;
}

interface DesktopQuizDiscussionControls {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface DesktopQuizExitControls {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  confirmExit: () => void;
}

interface DesktopQuizSubmitControls {
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  unansweredCount: number;
  complete: () => Promise<boolean>;
}

interface DesktopQuizLayoutProps {
  slug: string;
  quizTitle: string;
  questions: QuizPlayQuestionViewModel[];
  sessionEmail?: string | null;
  userEmail: string;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  answeredQuestions: number;
  progress: number;
  currentQuestion: QuizPlayQuestionViewModel;
  userAnswers: QuizAnswer[];
  discussion: DesktopQuizDiscussionControls;
  exit: DesktopQuizExitControls;
  error: string;
  selectAnswer: (index: number) => void;
  previousQuestion: () => void;
  nextQuestion: () => void;
  submitQuiz: () => Promise<boolean>;
  submitting: boolean;
  submit: DesktopQuizSubmitControls;
  t: TranslateFn;
}

interface DesktopQuizHeaderProps {
  slug: string;
  quizTitle: string;
  sessionEmail?: string | null;
  userEmail: string;
  currentQuestionIndex: number;
  questionCount: number;
  answeredQuestions: number;
  progress: number;
  onExit: () => void;
  t: TranslateFn;
}

interface DesktopQuestionCardProps {
  currentQuestion: QuizPlayQuestionViewModel;
  currentQuestionIndex: number;
  currentAnswer: QuizAnswer | undefined;
  questionCount: number;
  onToggleDiscussion: () => void;
  onSelectAnswer: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => Promise<boolean>;
  submitting: boolean;
  error: string;
  t: TranslateFn;
}

interface DesktopQuestionOverviewProps {
  questions: QuizPlayQuestionViewModel[];
  userAnswers: QuizAnswer[];
  currentQuestionIndex: number;
  onJumpToQuestion: (index: number) => void;
  t: TranslateFn;
}

interface DesktopDiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  questionIndex: number;
  t: TranslateFn;
}

interface DesktopExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
  answeredQuestions: number;
  questionCount: number;
  t: TranslateFn;
}

function isSelectedOption(
  question: QuizPlayQuestionViewModel,
  answer: QuizAnswer | undefined,
  optionIndex: number,
) {
  return question.type === 'single'
    ? answer === optionIndex
    : Array.isArray(answer) && answer.includes(optionIndex);
}

function OptionPreview({ src, alt, className }: OptionPreviewProps) {
  if (!src) {
    return null;
  }

  return <OptionImage src={src} alt={alt} {...(className !== undefined ? { className } : {})} />;
}

function DesktopQuizHeader({
  slug,
  quizTitle,
  sessionEmail,
  userEmail,
  currentQuestionIndex,
  questionCount,
  answeredQuestions,
  progress,
  onExit,
  t,
}: DesktopQuizHeaderProps) {
  return (
    <div className="border-b border-neutral-200/50 bg-white/80 sticky top-0 z-40 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl p-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-4">
            <Button
              variant="outline"
              onClick={onExit}
              className="border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50"
            >
              <HiOutlineArrowLeft className="mr-2 size-4" />
              {t('exitQuiz')}
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">{quizTitle}</h1>
              <div className="text-sm">
                {sessionEmail ? (
                  <Badge variant="success" className="text-xs">
                    <HiOutlineUser className="mr-1 size-3" />
                    {sessionEmail}
                  </Badge>
                ) : (
                  <Badge variant="default" className="text-xs">
                    <HiOutlineMail className="mr-1 size-3" />
                    {userEmail}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-x-4">
            <ReportQuiz quizSlug={slug} quizTitle={quizTitle} />
            <div className="text-right">
              <div className="text-sm font-semibold text-neutral-700">
                {t('question')} {currentQuestionIndex + 1} {t('of', { ns: 'common' })}{' '}
                {questionCount}
              </div>
              <div className="text-xs text-neutral-500">
                {answeredQuestions} {t('of', { ns: 'common' })} {questionCount} {t('answered')}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-600">
            <span>{t('progress')}</span>
            <span>
              {progress}% {t('complete')}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-brand-trust to-green-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopQuestionCard({
  currentQuestion,
  currentQuestionIndex,
  currentAnswer,
  questionCount,
  onToggleDiscussion,
  onSelectAnswer,
  onPrevious,
  onNext,
  onSubmit,
  submitting,
  error,
  t,
}: DesktopQuestionCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-xl font-semibold [&_p]:m-0 [&_p]:text-xl [&_p]:text-neutral-900">
              <QuestionContent content={currentQuestion.question} />
            </div>
          </div>
          <div className="ml-4 flex items-center gap-x-2">
            <Button
              variant="outline"
              onClick={onToggleDiscussion}
              className="border-green-200 text-brand-trust hover:border-green-300 hover:bg-green-50"
              title={t('discussion')}
            >
              {t('discussion')}
            </Button>
          </div>
        </div>

        {currentQuestion.questionImage ? (
          <div className="mt-4">
            <QuestionImage
              src={currentQuestion.questionImage}
              alt={`Question ${currentQuestionIndex + 1} image`}
            />
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => {
            const isSelected = isSelectedOption(currentQuestion, currentAnswer, index);

            return (
              <label
                key={option}
                className={`flex cursor-pointer items-center rounded-lg border-2 p-4 transition-colors ${
                  isSelected
                    ? 'border-green-500 bg-green-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <input
                  type={currentQuestion.type === 'single' ? 'radio' : 'checkbox'}
                  aria-label={`Option ${String.fromCharCode(65 + index)}`}
                  name={`question-${currentQuestionIndex}`}
                  value={index}
                  checked={isSelected}
                  onChange={() => onSelectAnswer(index)}
                  className="sr-only"
                />
                <div
                  className={`mr-3 flex size-4 items-center justify-center border-2 ${
                    currentQuestion.type === 'single' ? 'rounded-full' : 'rounded'
                  } ${isSelected ? 'border-green-500 bg-green-500' : 'border-neutral-300'}`}
                >
                  {isSelected ? (
                    currentQuestion.type === 'single' ? (
                      <div className="size-2 rounded-full bg-white" />
                    ) : (
                      <svg className="size-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )
                  ) : null}
                </div>
                <div className="flex-1">
                  <div className="text-neutral-900 [&_p]:m-0 [&_p]:text-base [&_p]:text-neutral-900">
                    <QuestionContent content={option} variant="option" />
                  </div>
                  <div className="mt-2">
                    <OptionPreview
                      {...(currentQuestion.optionImages?.[index] !== undefined
                        ? { src: currentQuestion.optionImages[index] }
                        : {})}
                      alt={`Option ${String.fromCharCode(65 + index)} image`}
                    />
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {error ? (
          <div className="mt-4 rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="outline" onClick={onPrevious} disabled={currentQuestionIndex === 0}>
            {t('previous')}
          </Button>

          <div className="text-sm text-neutral-600">
            {currentQuestionIndex + 1} / {questionCount}
          </div>

          {currentQuestionIndex === questionCount - 1 ? (
            <Button
              onClick={onSubmit}
              loading={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {t('submitQuiz')}
            </Button>
          ) : (
            <Button onClick={onNext} disabled={currentQuestionIndex === questionCount - 1}>
              {t('next')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DesktopQuestionOverview({
  questions,
  userAnswers,
  currentQuestionIndex,
  onJumpToQuestion,
  t,
}: DesktopQuestionOverviewProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">{t('questionOverview')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-10 gap-2">
          {questions.map((question, index) => {
            const isAnswered = isQuestionAnswered(question, userAnswers[index]);

            return (
              <button
                type="button"
                key={question.id ?? `${question.question}-${question.options.join('|')}`}
                onClick={() => onJumpToQuestion(index)}
                className={`size-8 rounded text-xs font-medium transition-colors ${
                  index === currentQuestionIndex
                    ? 'bg-brand-trust text-white'
                    : isAnswered
                      ? 'border border-green-300 bg-green-100 text-green-800'
                      : 'border border-neutral-300 bg-neutral-100 text-neutral-600'
                }`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-x-6 text-xs">
          <div className="flex items-center">
            <div className="mr-2 size-3 rounded bg-brand-trust" />
            <span>{t('current')}</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 size-3 rounded border border-green-300 bg-green-100" />
            <span>{t('answered')}</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 size-3 rounded border border-neutral-300 bg-neutral-100" />
            <span>{t('notAnswered')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DesktopDiscussionModal({
  isOpen,
  onClose,
  slug,
  questionIndex,
  t,
}: DesktopDiscussionModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('discussion')}
      size="large"
      className="md:hidden"
    >
      <div className="h-96">
        <QuestionDiscussion
          quizSlug={slug}
          questionIndex={questionIndex}
          isCollapsed={false}
          onToggleCollapse={onClose}
          isMobile={true}
        />
      </div>
    </Modal>
  );
}

function DesktopExitModal({
  isOpen,
  onClose,
  onConfirmExit,
  answeredQuestions,
  questionCount,
  t,
}: DesktopExitModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('exitQuiz')} size="small">
      <div className="space-y-4">
        <p className="text-neutral-700">{t('exitQuizWarning')}</p>

        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-start">
            <svg
              className="mr-2 mt-0.5 size-5 flex-shrink-0 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-green-800">{t('exitWarning')}</h4>
              <p className="mt-1 text-sm text-green-700">
                {t('exitWarningMessage', {
                  answered: answeredQuestions,
                  total: questionCount,
                })}
              </p>
            </div>
          </div>
        </div>

        <ModalActions
          cancelText={t('continueQuiz')}
          confirmText={t('exitQuiz')}
          confirmVariant="destructive"
          onCancel={onClose}
          onConfirm={onConfirmExit}
        />
      </div>
    </Modal>
  );
}

export function DesktopQuizLayout({
  slug,
  quizTitle,
  questions,
  sessionEmail,
  userEmail,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  answeredQuestions,
  progress,
  currentQuestion,
  userAnswers,
  discussion,
  exit,
  error,
  selectAnswer,
  previousQuestion,
  nextQuestion,
  submitQuiz,
  submitting,
  submit,
  t,
}: DesktopQuizLayoutProps) {
  const [discussionLoaded, setDiscussionLoaded] = useState(
    !discussion.collapsed || discussion.mobileOpen,
  );

  const setDiscussionCollapsed = (collapsed: boolean) => {
    if (!collapsed) {
      setDiscussionLoaded(true);
    }
    discussion.setCollapsed(collapsed);
  };

  return (
    <div className="min-h-screen">
      <DesktopQuizHeader
        slug={slug}
        quizTitle={quizTitle}
        {...(sessionEmail !== undefined ? { sessionEmail } : {})}
        userEmail={userEmail}
        currentQuestionIndex={currentQuestionIndex}
        questionCount={questions.length}
        answeredQuestions={answeredQuestions}
        progress={progress}
        onExit={exit.open}
        t={t}
      />

      <main
        className={`${discussion.collapsed ? 'max-w-4xl' : 'max-w-7xl'} mx-auto px-4 py-8 transition-all duration-300 sm:px-6 lg:px-8`}
      >
        <div className="flex">
          <div className={`flex-1 ${discussion.collapsed ? '' : 'pr-6'}`}>
            <DesktopQuestionCard
              currentQuestion={currentQuestion}
              currentQuestionIndex={currentQuestionIndex}
              currentAnswer={userAnswers[currentQuestionIndex]}
              questionCount={questions.length}
              onToggleDiscussion={() => setDiscussionCollapsed(!discussion.collapsed)}
              onSelectAnswer={selectAnswer}
              onPrevious={previousQuestion}
              onNext={nextQuestion}
              onSubmit={submitQuiz}
              submitting={submitting}
              error={error}
              t={t}
            />

            <DesktopQuestionOverview
              questions={questions}
              userAnswers={userAnswers}
              currentQuestionIndex={currentQuestionIndex}
              onJumpToQuestion={setCurrentQuestionIndex}
              t={t}
            />
          </div>

          {discussionLoaded ? (
            <QuestionDiscussion
              quizSlug={slug}
              questionIndex={currentQuestionIndex}
              isCollapsed={discussion.collapsed}
              onToggleCollapse={() => setDiscussionCollapsed(!discussion.collapsed)}
            />
          ) : null}
        </div>

        {discussion.mobileOpen ? (
          <DesktopDiscussionModal
            isOpen
            onClose={() => discussion.setMobileOpen(false)}
            slug={slug}
            questionIndex={currentQuestionIndex}
            t={t}
          />
        ) : null}

        <DesktopExitModal
          isOpen={exit.isOpen}
          onClose={exit.close}
          onConfirmExit={exit.confirmExit}
          answeredQuestions={answeredQuestions}
          questionCount={questions.length}
          t={t}
        />

        <ConfirmModal
          isOpen={submit.confirmOpen}
          title={`${t('submitQuiz')}?`}
          message={t('unansweredWarning', { count: submit.unansweredCount })}
          confirmText={t('submit')}
          cancelText={t('cancel')}
          confirmVariant="primary"
          isLoading={submitting}
          onCancel={() => submit.setConfirmOpen(false)}
          onConfirm={() => void submit.complete()}
        />
      </main>
    </div>
  );
}
