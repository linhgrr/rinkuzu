'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { ButtonBase } from '@/components/ui/ButtonBase';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { ModalActions } from '@/components/ui/ModalActions';
import { HiOutlineArrowLeft, HiOutlineMail, HiOutlineUser } from 'react-icons/hi';
import ReportQuiz from '@/features/quiz/components/ReportQuiz';
import { QuizQuestionCard } from '@/features/quiz/components/player/QuizQuestionCard';
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
        className="h-full min-h-64 w-full animate-pulse bg-neutral-50 md:sticky md:top-0 md:h-screen md:w-80 md:border-l md:border-line"
      />
    ),
  },
);

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

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

function DesktopQuizHeader({
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
    <div className="border-b border-line/50 bg-white/80 sticky top-0 z-40 backdrop-blur-sm">
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
              className="h-3 rounded-full bg-brand-action transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
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
              <ButtonBase
                type="button"
                key={question.id ?? `${question.question}-${question.options.join('|')}`}
                onClick={() => onJumpToQuestion(index)}
                className={`size-8 rounded text-xs font-medium transition-colors ${
                  index === currentQuestionIndex
                    ? 'bg-brand-trust text-white'
                    : isAnswered
                      ? 'border border-green-300 bg-green-100 text-green-800'
                      : 'border border-control-border bg-neutral-100 text-neutral-600'
                }`}
              >
                {index + 1}
              </ButtonBase>
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
            <div className="mr-2 size-3 rounded border border-control-border bg-neutral-100" />
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
            <QuizQuestionCard
              question={currentQuestion}
              questionIndex={currentQuestionIndex}
              answer={userAnswers[currentQuestionIndex]}
              questionCount={questions.length}
              headerActions={
                <>
                  <ReportQuiz
                    quizSlug={slug}
                    quizTitle={quizTitle}
                    questionId={currentQuestion.id}
                    questionNumber={currentQuestionIndex + 1}
                    questionText={currentQuestion.question}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setDiscussionCollapsed(!discussion.collapsed)}
                    className="border-green-200 text-brand-trust hover:border-green-300 hover:bg-green-50"
                    title={t('discussion')}
                  >
                    {t('discussion')}
                  </Button>
                </>
              }
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
